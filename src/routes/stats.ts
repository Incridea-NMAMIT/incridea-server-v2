import { Router } from 'express'
import { getStats } from '../controllers/statsController'
import { authenticateJWT } from '../middlewares/authMiddleware'
import { requireAdmin } from '../middlewares/authorizeAdmin'

const router = Router()

router.get('/', authenticateJWT, requireAdmin, getStats)

export default router
