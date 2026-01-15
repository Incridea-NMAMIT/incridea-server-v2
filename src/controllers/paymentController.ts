import type { Request, Response } from 'express'
import crypto from 'crypto'
import prisma from '../prisma/client'
import { RAZORPAY_WEBHOOK_SECRET, razorpay } from '../services/razorpay'
import { Status, PaymentType, AccommodationBookingStatus } from '@prisma/client'
import { listVariables } from '../services/adminService'
import { generatePID } from '../services/pidService'

export async function initiatePayment(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const { registrationId } = req.body

    if (!registrationId) {
      return res.status(400).json({ message: 'Registration option is required' })
    }

    // Fetch latest fee variables
    const variables = await listVariables()
    const getFee = (key: string) => {
      const v = variables.find((variable) => variable.key === key)
      const parsed = Number(v?.value)
      return Number.isFinite(parsed) ? parsed : 0
    }

    let feeKey = ''
    switch (registrationId) {
      case 'internal-onspot':
        feeKey = 'internalRegistrationOnSpot'
        break
      case 'internal-merch':
        feeKey = 'internalRegistrationFeeInclusiveMerch'
        break
      case 'internal-pass':
        feeKey = 'internalRegistrationFeeGen'
        break
      case 'external-onspot':
        feeKey = 'externalRegistrationFeeOnSpot'
        break
      case 'external-early':
        feeKey = 'externalRegistrationFee'
        break
      default:
        // Optional: Handle ALUMNI if needed, but frontend didn't show it explicitly in the map above yet for 'alumni' ID.
        // If the user sends something else
        return res.status(400).json({ message: 'Invalid registration option' })
    }

    const amount = getFee(feeKey)

    if (amount <= 0) {
      return res.status(400).json({ message: 'Invalid fee amount configuration' })
    }

    // Create Razorpay Order
    // Amount in paisa
    // We want the platform to receive `amount` (which is in INR).
    // Razorpay deducts 2.36% (0.0236) from the total transaction amount.
    // The user wants the total transaction amount to be rounded up to the next whole Rupee.
    
    // 1. Calculate the exact gross amount required: T_exact = amount / (1 - 0.0236)
    // 2. Round up to the next whole Rupee: T_rounded = Math.ceil(T_exact)
    // 3. Convert to paisa: T_paisa = T_rounded * 100

    const amountInRupees = Math.ceil(amount / (1 - 0.0236))
    const amountInPaisa = amountInRupees * 100

    const orderOptions = {
        amount: amountInPaisa,
        currency: 'INR',
        receipt: `receipt_${Date.now()}_${userId}`,
        notes: {
            userId: String(userId),
            registrationId,
            type: PaymentType.FEST_REGISTRATION
        }
    }

    const order = await razorpay.orders.create(orderOptions)

    if (!order) {
        return res.status(500).json({ message: 'Failed to create payment order' })
    }

    // Save to DB
    await prisma.paymentOrder.create({
        data: {
            orderId: order.id,
            amount: amount,
            status: Status.PENDING,
            type: PaymentType.FEST_REGISTRATION,
            userId,
            paymentData: order as any // Storing the initial order data
        }
    })

    return res.status(200).json({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID,
        name: 'Incridea', // Or fetch from config
        description: 'Fest Registration',
        prefill: {
            // We can optionally return user details if we want frontend to prefill
        }
    })

  } catch (error) {
    console.error('Initiate Payment Error:', error)
    return res.status(500).json({ message: 'Internal Server Error' })
  }
}


export async function handleRazorpayWebhook(req: Request, res: Response) {
  try {
    const signature = req.headers['x-razorpay-signature'] as string
    
    // Check if secret is configured
    if (!RAZORPAY_WEBHOOK_SECRET) {
        console.error('RAZORPAY_WEBHOOK_SECRET is not set')
        return res.status(500).json({ message: 'Server configuration error' })
    }

    if (!signature) {
      return res.status(400).json({ message: 'Missing signature' })
    }

    // Verify signature
    const body = (req as any).rawBody
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex')

    if (expectedSignature !== signature) {
      console.error('Invalid Razorpay signature')
      return res.status(400).json({ message: 'Invalid signature' })
    }

    const event = req.body
    
    // Log the event for debugging (optional, consider removing in production if too verbose)
    console.log('Razorpay Webhook Event:', event.event)

    if (event.event === 'order.paid' || event.event === 'payment.captured') {
      const paymentEntity = event.payload.payment.entity
      const orderId = paymentEntity.order_id
      
      // 1. Check for Fest Registration Payment
      const paymentOrder = await prisma.paymentOrder.findUnique({
          where: { orderId }
      })

      if (paymentOrder) {
          await prisma.paymentOrder.update({
            where: { orderId },
            data: {
              status: Status.SUCCESS,
              paymentData: paymentEntity,
            },
          })
          console.log(`Payment successful for order ${orderId}, User ID: ${paymentOrder.userId}`)

          // Generate PID if it's a FEST_REGISTRATION
          if (paymentOrder.type === PaymentType.FEST_REGISTRATION) {
              try {
                  await generatePID(paymentOrder.userId, paymentOrder.orderId)
                  console.log(`PID generated for User ID: ${paymentOrder.userId}`)
              } catch (pidError) {
                  console.error('Error generating PID:', pidError)
              }
          }
          return res.status(200).json({ status: 'ok' })
      }

      // 2. Check for Accommodation Payment
      const accPayment = await prisma.accommodationPayment.findUnique({
          where: { orderId }
      })

      if (accPayment) {
          await prisma.accommodationPayment.update({
              where: { orderId },
              data: {
                  status: Status.SUCCESS,
                  paymentData: paymentEntity
              }
          })
          
          // Confirm all linked bookings
          await prisma.accommodationBooking.updateMany({
              where: { paymentId: accPayment.id },
              data: { status: AccommodationBookingStatus.CONFIRMED }
          })

          console.log(`Accommodation Payment successful for order ${orderId}`)
          return res.status(200).json({ status: 'ok' })
      }

      console.error(`Order not found for orderId: ${orderId}`)

    } else if (event.event === 'payment.failed') {
      const paymentEntity = event.payload.payment.entity
      const orderId = paymentEntity.order_id
      
      const paymentOrder = await prisma.paymentOrder.findUnique({ where: { orderId } })
      
      if (paymentOrder) {
        await prisma.paymentOrder.update({
            where: { orderId },
            data: {
            status: Status.FAILED,
            paymentData: paymentEntity,
            },
        })
        console.log(`Payment failed for order ${orderId}, User ID: ${paymentOrder.userId}`)
        return res.status(200).json({ status: 'ok' })
      }

      const accPayment = await prisma.accommodationPayment.findUnique({ where: { orderId } })
      
      if (accPayment) {
          await prisma.accommodationPayment.update({
              where: { orderId },
              data: {
                  status: Status.FAILED,
                  paymentData: paymentEntity
              }
          })
          
          // Cancel linked bookings
          await prisma.accommodationBooking.updateMany({
              where: { paymentId: accPayment.id },
              data: { status: AccommodationBookingStatus.CANCELLED }
          })
          
          console.log(`Accommodation Payment failed for order ${orderId}`)
          return res.status(200).json({ status: 'ok' })
      }

      console.error(`Order not found for orderId: ${orderId}`)
    }

    // Handle other events if necessary

    return res.status(200).json({ status: 'ok' })
  } catch (error) {
    console.error('Razorpay Webhook Error:', error)
    return res.status(500).json({ message: 'Internal Server Error' })
  }
}
