import { Router } from 'express'
import { getQuizPublic, submitQuizAnswer, finishQuiz, startQuiz } from '../controllers/quizController'
import { authenticateJWT } from '../middlewares/authMiddleware'

const router = Router()

router.get('/:quizId', authenticateJWT, getQuizPublic)
router.post('/:quizId/start', authenticateJWT, startQuiz)
router.post('/:quizId/submit', authenticateJWT, submitQuizAnswer)
router.post('/:quizId/finish', authenticateJWT, finishQuiz)

export default router
