import { Router } from 'express'
import { getProtectedResource } from '../controllers/protectedController'
import { authenticateJWT } from '../middlewares/authMiddleware'

const router = Router()

router.get('/', authenticateJWT, getProtectedResource)

export default router
