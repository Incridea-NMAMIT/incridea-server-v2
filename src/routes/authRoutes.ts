import { Router } from 'express'
import { login, signup } from '../controllers/authController'
import { validateRequest } from '../middlewares/validateRequest'
import { loginSchema, signupSchema } from '../schemas/authSchemas'

const router = Router()

router.post('/signup', validateRequest(signupSchema), signup)
router.post('/login', validateRequest(loginSchema), login)

export default router
