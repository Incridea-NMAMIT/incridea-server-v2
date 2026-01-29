
import type { Request, Response } from 'express'
import crypto from 'crypto'
import prisma from '../prisma/client'
import { RAZORPAY_WEBHOOK_SECRET, razorpay } from '../services/razorpay'
import { Status, PaymentType, AccommodationBookingStatus, PaymentPurpose, PaymentStatus, PaymentMethod } from '@prisma/client'
import { listVariables } from '../services/adminService'
import { generatePID } from '../services/pidService'

import { setPaymentStep, getPaymentStep, clearPaymentStep } from '../utils/paymentStatusStore'

import { getIO } from '../socket'
import { addReceiptJob } from '../utils/queue'

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

    console.log('Creating Razorpay Order with options:', JSON.stringify(orderOptions, null, 2))
    const order = await razorpay.orders.create(orderOptions)

    if (!order) {
        return res.status(500).json({ message: 'Failed to create payment order' })
    }

    // Save to DB
    await prisma.paymentOrder.create({
        data: {
            orderId: order.id,
            amount: amount,
            collectedAmount: amountInRupees,
            status: Status.PENDING,
            type: PaymentType.FEST_REGISTRATION,
            userId,
            paymentDataJson: order as any // Storing the initial order data
        } as any // CASTING AS ANY TO AVOID TYPE ISSUES
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

    if (event.event === 'order.paid' || event.event === 'payment.captured' || event.event === 'payment.failed') {
      const paymentEntity = event.payload.payment.entity
      const orderId = paymentEntity.order_id
      const isSuccess = event.event !== 'payment.failed';
      
      // 1. Check for Fest Registration Payment
      const paymentOrder = await prisma.paymentOrder.findUnique({
          where: { orderId }
      })

      if (paymentOrder) {
          // Prepare Payment Record Data
          const paymentData = createPaymentDataFromEntity(paymentEntity, paymentOrder);

          if (isSuccess) {
            await processSuccessfulPayment(paymentOrder, paymentEntity, paymentData);
          } else {
             // Handle Failure
             await prisma.$transaction(async (tx) => {
                 // Create Payment record
                 // Check if already exists to avoid unique constraint error
                 const existing = await tx.payment.findUnique({ where: { gatewayPaymentId: paymentEntity.id }});
                 if (!existing) {
                    await tx.payment.create({
                        data: paymentData as any
                    });
                 }
    
                 await tx.paymentOrder.update({
                    where: { orderId },
                    data: {
                      status: Status.FAILED,
                      paymentDataJson: paymentEntity,
                    } as any, // CASTING AS ANY
                  })
              });
             console.log(`Payment failed for order ${orderId}, User ID: ${paymentOrder.userId}`)
             // Notify user via socket
             const io = getIO()
             io.to(`user-${paymentOrder.userId}`).emit('payment_failed')
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
                  status: isSuccess ? Status.SUCCESS : Status.FAILED,
                  paymentData: paymentEntity
              }
          })
          
          if (isSuccess) {
              // Confirm all linked bookings
              await prisma.accommodationBooking.updateMany({
                  where: { paymentId: accPayment.id },
                  data: { status: AccommodationBookingStatus.CONFIRMED }
              })
              console.log(`Accommodation Payment successful for order ${orderId}`)
          } else {
             // Cancel linked bookings
              await prisma.accommodationBooking.updateMany({
                where: { paymentId: accPayment.id },
                data: { status: AccommodationBookingStatus.CANCELLED }
              })
             console.log(`Accommodation Payment failed for order ${orderId}`)
          }

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

export async function verifyPayment(req: Request, res: Response) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing payment details' })
    }

    const secret = process.env.RAZORPAY_KEY_SECRET
    if (!secret) {
      console.error('RAZORPAY_KEY_SECRET is not set')
      return res.status(500).json({ message: 'Server configuration error' })
    }

    // 1. Verify Signature
    const body = razorpay_order_id + '|' + razorpay_payment_id
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body.toString())
      .digest('hex')

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: 'Invalid signature' })
    }

    // 2. Check Payment Status in DB
    const paymentOrder = await prisma.paymentOrder.findUnique({
      where: { orderId: razorpay_order_id },
    })

    if (!paymentOrder) {
      return res.status(404).json({ message: 'Order not found' })
    }

    if (paymentOrder.status === Status.SUCCESS) {
      // Fetch PID if exists
      const pid = await prisma.pID.findFirst({
          where: { userId: paymentOrder.userId }
      })

      // RETRY LOGIC: If receipt is missing, trigger generation again
      if (!paymentOrder.receipt) {
          console.warn(`Payment ${paymentOrder.orderId} is SUCCESS but missing receipt. Retrying generation...`);
          // Note: We need payment entity. Since it's success, paymentDataJson should have it.
          const paymentEntity = paymentOrder.paymentDataJson; 
          if (paymentEntity) {
              const paymentData = createPaymentDataFromEntity(paymentEntity, paymentOrder);
              // Trigger async to not block response? Or await? 
              // Awaiting is safer to ensure it gets queued.
              try {
                  await processSuccessfulPayment(paymentOrder, paymentEntity, paymentData);
              } catch (e) {
                  console.error("Retry generation failed:", e);
              }
          } else {
              console.error("Refetching payment from Razorpay for missing receipt...");
               const payment = await razorpay.payments.fetch(razorpay_payment_id)
               if(payment) {
                   const paymentData = createPaymentDataFromEntity(payment, paymentOrder);
                   await processSuccessfulPayment(paymentOrder, payment, paymentData);
               }
          }
      }

      return res.status(200).json({ 
          status: 'success', 
          message: 'Payment verified successfully',
          pid: pid?.pidCode 
      })
    }

    // 3. If Pending/Failed locally, fetch from Razorpay to confirm
    // sometimes webhook might be delayed
    const payment = await razorpay.payments.fetch(razorpay_payment_id)

    if (!payment) {
        return res.status(404).json({ message: 'Payment not found on Razorpay' })
    }

    if (payment.status === 'captured' || payment.status === 'authorized') {
        const paymentData = createPaymentDataFromEntity(payment, paymentOrder)
         
         // Await processing to ensure receipt generation attempts verify completion
         try {
             await processSuccessfulPayment(paymentOrder, payment, paymentData);
         } catch (err) {
             console.error('Synchronous payment processing failed:', err)
         }

         return res.status(200).json({ 
             status: 'processing', 
             message: 'Payment verification in progress',
             pid: null
         })
    } else {
         return res.status(400).json({ status: 'failure', message: 'Payment not captured' })
    }

  } catch (error) {
    console.error('Verify Payment Error:', error)
    return res.status(500).json({ message: 'Internal Server Error' })
  }
}

export async function getMyPaymentStatus(req: Request, res: Response) {
    try {
        const userId = (req as any).user?.id
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' })
        }

        // Fetch the latest FEST_REGISTRATION PaymentOrder
        const paymentOrder = await prisma.paymentOrder.findFirst({
            where: { 
                userId,
                type: PaymentType.FEST_REGISTRATION
            },
            orderBy: { createdAt: 'desc' }
        })

        if (!paymentOrder) {
             return res.status(200).json({ status: 'none', message: 'No payment found' })
        }
        
        // Check PID
        const pidEntry = await prisma.pID.findFirst({
            where: { userId }
        })

        // We return success ONLY if we have PID AND Receipt (if success)
        // If payment is success but no PID/Receipt, we might be processing.
        
        const currentStep = getPaymentStep(paymentOrder.orderId)
        
        let status = 'pending';
        if (paymentOrder.status === Status.SUCCESS) {
            // Only return success if we have both PID and Receipt (or if logic dictates)
            // If we are still generating them, we should say 'processing' so frontend shows steps
            if (pidEntry && paymentOrder.receipt) {
                status = 'success';
            } else {
                status = 'processing';
            }
        }
        else if (paymentOrder.status === Status.FAILED) status = 'failed';

        return res.status(200).json({
            status: status,
            pid: pidEntry?.pidCode,
            receipt: paymentOrder.receipt,
            processingStep: currentStep
        })

    } catch (error) {
        console.error('Get Payment Status Error:', error)
        return res.status(500).json({ message: 'Internal Server Error' })
    }
}

import redis from '../services/redis'

// ... (existing imports)

// Helper to process successful payment (update DB, generate PID)
async function processSuccessfulPayment(paymentOrder: any, paymentEntity: any, paymentData: any) {
    const io = getIO()

    // Update PaymentOrder and Create Payment
    await prisma.$transaction(async (tx) => {
        // Create Payment record
        // Check if already exists to avoid unique constraint error
        const existing = await tx.payment.findUnique({ where: { gatewayPaymentId: paymentEntity.id }});
        if (!existing) {
        await tx.payment.create({
            data: paymentData as any
        });
        }

        await tx.paymentOrder.update({
        where: { orderId: paymentOrder.orderId },
        data: {
            status: Status.SUCCESS,
            paymentDataJson: paymentEntity,
        } as any, // CASTING AS ANY
        })
    });

    console.log(`Payment successful for order ${paymentOrder.orderId}, User ID: ${paymentOrder.userId}`)

    // Emit Payment Success via Socket
    io.to(`user-${paymentOrder.userId}`).emit('payment_success')

    // Emit Payment Success Event to Redis Stream
    try {
        await redis.xadd('payment:events', '*', 
            'orderId', paymentOrder.orderId,
            'userId', paymentOrder.userId,
            'paymentId', paymentEntity.id || paymentOrder.paymentData?.gatewayPaymentId || '', 
            'type', paymentOrder.type,
            'timestamp', new Date().toISOString()
        )
        console.log(`Emitted payment.success event for order ${paymentOrder.orderId}`)
    } catch (error) {
        console.error('Failed to emit payment.success event:', error)
    }

    // Refetch the latest PaymentOrder to ensure we have the committed status and check for existing receipt
    const freshPaymentOrder = await prisma.paymentOrder.findUnique({
        where: { orderId: paymentOrder.orderId }
    })

    if (!freshPaymentOrder) {
        console.error('PaymentOrder disappeared after update:', paymentOrder.orderId)
        return null
    }

    // Generate PID if it's a FEST_REGISTRATION
    if (freshPaymentOrder.type === PaymentType.FEST_REGISTRATION) {
        try {
            console.log(`Processing FEST_REGISTRATION for User ID: ${freshPaymentOrder.userId}, Order ID: ${freshPaymentOrder.orderId}`);

            const user = await prisma.user.findUnique({ 
                where: { id: freshPaymentOrder.userId },
                include: { College: true }
            })
            
            if (!user) {
                 console.error('User not found for receipt and PID generation:', freshPaymentOrder.userId);
                 io.to(`user-${freshPaymentOrder.userId}`).emit('payment_failed')
                 return null;
            }

            // 3. Generate PID
            console.log(`Generating PID for User ID: ${freshPaymentOrder.userId}...`);
            io.to(`user-${freshPaymentOrder.userId}`).emit('generating_pid')
            
            setPaymentStep(freshPaymentOrder.orderId, 'GENERATING_PID')

            const pidContext = await generatePID(freshPaymentOrder.userId, freshPaymentOrder.orderId)
            console.log(`PID generated successfully: ${pidContext.pidCode}`)
            
            // 4. Queue Receipt Generation
            console.log(`Queueing Receipt for Order ID: ${freshPaymentOrder.orderId}...`)
            io.to(`user-${freshPaymentOrder.userId}`).emit('generating_receipt') 
            
            // Prepare data for receipt generator
            const orderDataForReceipt = {
                orderId: freshPaymentOrder.orderId,
                type: freshPaymentOrder.type,
                updatedAt: freshPaymentOrder.updatedAt,
                collectedAmount: freshPaymentOrder.collectedAmount,
                paymentData: freshPaymentOrder.paymentDataJson,
            }
            
            const userDataForReceipt = {
                name: user.name,
                email: user.email,
                phoneNumber: user.phoneNumber,
                college: user.College?.name,
                pid: pidContext.pidCode 
            }

            // Add to Queue
            console.log(`Adding receipt job to queue for ${freshPaymentOrder.orderId}`);
            await addReceiptJob({
                orderData: orderDataForReceipt,
                userData: userDataForReceipt,
                userId: freshPaymentOrder.userId
            })

            setPaymentStep(freshPaymentOrder.orderId, 'COMPLETED')
            
            // Emit PID Generated (and implicit receipt completion)
            io.to(`user-${freshPaymentOrder.userId}`).emit('pid_generated', { pid: pidContext.pidCode })

            // Optional: Schedule cleanup 
            setTimeout(() => clearPaymentStep(freshPaymentOrder.orderId), 60000) // Clear after 1 minute

            return pidContext.pidCode

        } catch (error) {
            console.error('Error during post-payment processing (PID/Receipt):', error)
            io.to(`user-${freshPaymentOrder.userId}`).emit('payment_failed')
            return null
        }
    }
    return null
}


function createPaymentDataFromEntity(data: any, order: any): any {
    // Map JSON to Payment fields
    // Determine PaymentPurpose
    let purpose: any = PaymentPurpose.FEST_REGISTRATION; // Default based on user sample
    if (data.notes && data.notes.type) {
        if (data.notes.type === 'FEST_REGISTRATION') purpose = PaymentPurpose.FEST_REGISTRATION;
        else if (data.notes.type === 'ACCOMMODATION' || data.notes.type === 'ACC_REGISTRATION') purpose = PaymentPurpose.ACCOMMODATION;
        else if (data.notes.type === 'MERCH') purpose = PaymentPurpose.MERCH;
    } else if (order.type === 'FEST_REGISTRATION') {
       purpose = PaymentPurpose.FEST_REGISTRATION;
    }

    // Map Status
    let status: any = PaymentStatus.CREATED;
    const s = data.status;
    if (s === 'created') status = PaymentStatus.CREATED;
    else if (s === 'authorized') status = PaymentStatus.AUTHORIZED;
    else if (s === 'captured') status = PaymentStatus.CAPTURED;
    else if (s === 'failed') status = PaymentStatus.FAILED;
    else if (s === 'refunded') status = PaymentStatus.REFUNDED;

    // Map Method
    let method: any = PaymentMethod.UPI; // Default or fallback
    const m = data.method;
    if (m === 'card') method = PaymentMethod.CARD;
    else if (m === 'netbanking') method = PaymentMethod.NETBANKING;
    else if (m === 'upi') method = PaymentMethod.UPI;
    else if (m === 'wallet') method = PaymentMethod.WALLET;
    else if (m === 'emi') method = PaymentMethod.EMI;

    return {
        gatewayPaymentId: data.id,
        gatewayOrderId: data.order_id,
        entity: data.entity,
        amount: typeof data.amount === 'string' ? parseInt(data.amount) : (data.amount || 0),
        fee: typeof data.fee === 'string' ? parseInt(data.fee) : data.fee,
        tax: typeof data.tax === 'string' ? parseInt(data.tax) : data.tax,
        amountRefunded: typeof data.amount_refunded === 'string' ? parseInt(data.amount_refunded) : (data.amount_refunded || 0),
        currency: data.currency || 'INR',
        status: status,
        captured: data.captured || false,
        refundStatus: data.refund_status,
        international: data.international || false,
        method: method,
        bankCode: data.bank,
        wallet: data.wallet,
        vpa: data.vpa,
        cardId: data.card_id,
        bankTransactionId: data.acquirer_data?.bank_transaction_id,
        email: data.email,
        contact: data.contact,
        purpose: purpose,
        registrationId: data.notes?.registrationId,
        userId: data.notes?.userId,
        errorCode: data.error_code,
        errorReason: data.error_reason,
        errorSource: data.error_source,
        errorStep: data.error_step,
        errorDescription: data.error_description,
    createdAt: data.created_at ? new Date(data.created_at * 1000) : new Date(),
    };
}

export async function verifyReceiptAccess(req: Request, res: Response) {
  try {
    const { orderId } = req.params
    const { paymentId } = req.query

    if (!orderId || !paymentId) {
      return res.status(400).send('Invalid request')
    }

    const paymentOrder = await prisma.paymentOrder.findUnique({
      where: { orderId: orderId as string },
      include: {
        paymentData: true, 
      }
    })

    if (!paymentOrder) {
      return res.status(404).send('Receipt not found')
    }

    if (!paymentOrder.receipt) {
      return res.status(404).send('Receipt not generated yet')
    }

    // Verify Payment ID matches
    // We check against the stored JSON or the related Payment record
    const storedPaymentData = paymentOrder.paymentDataJson as any
    const storedPaymentId = storedPaymentData?.id || storedPaymentData?.entity?.id || paymentOrder.paymentData?.gatewayPaymentId

    if (String(paymentId) !== String(storedPaymentId)) {
      return res.status(403).send('Unauthorized access')
    }

    // Serve PDF Inline
    // Fetch the PDF from the UploadThing URL
    const response = await fetch(paymentOrder.receipt);
    
    if (!response.ok) {
        throw new Error(`Failed to fetch receipt: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="receipt_${orderId}.pdf"`);
    return res.send(buffer);

  } catch (error) {
    console.error('Verify Receipt Access Error:', error)
    return res.status(500).send('Internal Server Error')
  }
}
