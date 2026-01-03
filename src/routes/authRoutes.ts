import { Router } from 'express'
import {
	login,
	signup,
	verifyOtp,
	me,
	changePasswordHandler,
	requestPasswordResetHandler,
  resetPasswordHandler,
  verifyMasterKey,
} from '../controllers/authController'
import { validateRequest } from '../middlewares/validateRequest'
import {
  loginSchema,
  signupSchema,
  verifyOtpSchema,
  changePasswordSchema,
  resetPasswordRequestSchema,
  resetPasswordConfirmSchema,
} from '../schemas/authSchemas'
import { authenticateJWT } from '../middlewares/authMiddleware'
import { z } from 'zod'

const router = Router()

const verifyMasterKeySchema = z.object({
  key: z.string().min(1, 'Master key is required'),
})

router.post('/signup', validateRequest(signupSchema), signup)
router.post('/login', validateRequest(loginSchema), login)
router.post('/verify-otp', validateRequest(verifyOtpSchema), verifyOtp)
router.get('/me', authenticateJWT, me)
router.post('/change-password', authenticateJWT, validateRequest(changePasswordSchema), changePasswordHandler)
router.post('/request-password-reset', validateRequest(resetPasswordRequestSchema), requestPasswordResetHandler)
router.post('/reset-password', validateRequest(resetPasswordConfirmSchema), resetPasswordHandler)
router.post('/verify-master', validateRequest(verifyMasterKeySchema), verifyMasterKey)

export default router
