import type { Request, Response } from 'express'
import crypto from 'crypto'
import prisma from '../prisma/client'
import { RAZORPAY_WEBHOOK_SECRET } from '../services/razorpay'
import { Status } from '@prisma/client'


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
      
      // Update PaymentOrder status
      const paymentOrder = await prisma.paymentOrder.update({
        where: { orderId },
        data: {
          status: Status.SUCCESS,
          paymentData: paymentEntity,
        },
      })
      
      console.log(`Payment successful for order ${orderId}, User ID: ${paymentOrder.userId}`)
    }

    // Handle other events if necessary (e.g., payment.failed)

    return res.status(200).json({ status: 'ok' })
  } catch (error) {
    console.error('Razorpay Webhook Error:', error)
    return res.status(500).json({ message: 'Internal Server Error' })
  }
}
