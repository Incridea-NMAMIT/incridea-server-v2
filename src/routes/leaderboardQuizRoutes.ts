import { Router } from 'express'
import { authenticateJWT } from '../middlewares/authMiddleware'
import { requireAdmin } from '../middlewares/authorizeAdmin'
import { getQuestions, createQuestion } from '../controllers/leaderboardQuizController'

const router = Router()

router.use(authenticateJWT, requireAdmin)

router.get('/', getQuestions)
router.post('/', createQuestion)

export default router
