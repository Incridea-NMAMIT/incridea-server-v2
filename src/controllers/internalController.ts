import { Request, Response } from 'express'
import prisma from '../prisma/client'

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || 'supersecretinternal123'

const verifySecret = (req: Request) => {
    const secret = req.headers['x-internal-secret']
    return secret === INTERNAL_SECRET
}

export async function getPaymentDetails(req: Request, res: Response) {
    if (!verifySecret(req)) return res.status(403).json({ message: 'Forbidden' })

    const { orderId } = req.params
    try {
        const order = await prisma.paymentOrder.findUnique({
            where: { orderId },
            include: { User: true }
        })

        if (!order) return res.status(404).json({ message: 'Order not found' })

        if (order.receipt) {
            return res.status(200).json({ 
                ...order, 
                alreadyGenerated: true 
            })
        }

        return res.status(200).json({
            order_data: {
                ...order,
                collectedAmount: order.collectedAmount.toString() 
            },
            user_data: order.User
        })
    } catch (e) {
        console.error(e)
        return res.status(500).json({ message: 'Internal Server Error' })
    }
}

export async function updateReceipt(req: Request, res: Response) {
    if (!verifySecret(req)) return res.status(403).json({ message: 'Forbidden' })

    const { orderId } = req.params
    const { receiptUrl } = req.body

    if (!receiptUrl) return res.status(400).json({ message: 'Missing receipt URL' })

    try {
        await prisma.paymentOrder.update({
            where: { orderId },
            data: { receipt: receiptUrl }
        })
        return res.json({ success: true })
    } catch (e) {
        console.error(e)
        return res.status(500).json({ message: 'Internal Server Error' })
    }
}
