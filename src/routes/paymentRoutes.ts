import { Router } from 'express'
import { handleRazorpayWebhook } from '../controllers/paymentController'

const router = Router()

router.post('/webhook', handleRazorpayWebhook)

export default router
