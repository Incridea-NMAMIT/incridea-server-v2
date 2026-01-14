import { Router } from 'express'
import { handleRazorpayWebhook, initiatePayment } from '../controllers/paymentController'
import { authenticateJWT } from '../middlewares/authMiddleware'

const router = Router()

router.post('/initiate', authenticateJWT, initiatePayment)
router.post('/webhook', handleRazorpayWebhook)

export default router
