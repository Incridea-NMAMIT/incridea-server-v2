import { Router } from 'express'
import { handleRazorpayWebhook, initiatePayment, verifyPayment, verifyReceiptAccess, getMyPaymentStatus } from '../controllers/paymentController'
import { authenticateJWT } from '../middlewares/authMiddleware'

const router = Router()

router.post('/initiate', authenticateJWT, initiatePayment)
router.post('/verify', authenticateJWT, verifyPayment)
router.post('/webhook', handleRazorpayWebhook)
router.get('/my-status', authenticateJWT, getMyPaymentStatus)
router.get('/receipt/:orderId/verify', verifyReceiptAccess)

export default router
