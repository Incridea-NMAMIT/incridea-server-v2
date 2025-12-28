import { Router } from 'express'
import {
	login,
	signup,
	verifyOtp,
	me,
	changePasswordHandler,
	requestPasswordResetHandler,
	resetPasswordHandler,
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

const router = Router()

router.post('/signup', validateRequest(signupSchema), signup)
router.post('/login', validateRequest(loginSchema), login)
router.post('/verify-otp', validateRequest(verifyOtpSchema), verifyOtp)
router.get('/me', authenticateJWT, me)
router.post('/change-password', authenticateJWT, validateRequest(changePasswordSchema), changePasswordHandler)
router.post('/request-password-reset', validateRequest(resetPasswordRequestSchema), requestPasswordResetHandler)
router.post('/reset-password', validateRequest(resetPasswordConfirmSchema), resetPasswordHandler)

export default router
