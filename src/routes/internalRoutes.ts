import { Router } from 'express'
import { getPaymentDetails, updateReceipt } from '../controllers/internalController'

const router = Router()

router.get('/payment/:orderId', getPaymentDetails)
router.post('/payment/:orderId/receipt', updateReceipt)

export default router
