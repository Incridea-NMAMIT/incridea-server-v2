import { Router } from 'express'
import { authenticateJWT } from '../middlewares/authMiddleware'
import { getJudgeRounds, 
  getTeamsByRound, 
  promoteTeam, 
  selectWinner, 
  submitScore, 
  deleteWinner,
  updateRoundStatus,
  getWinnersByEvent,
  getAllWinners,
  getScoreSheet
} from '../controllers/judgingController'

const router = Router()

router.use(authenticateJWT)


router.get('/rounds', getJudgeRounds)
router.get('/events/:eventId/rounds/:roundNo/teams', getTeamsByRound)
router.post('/events/:eventId/rounds/:roundNo/score', submitScore)
router.post('/events/:eventId/rounds/:roundNo/promote', promoteTeam)
router.post('/events/:eventId/winners', selectWinner)
router.delete('/winners/:winnerId', deleteWinner)
router.patch('/events/:eventId/rounds/:roundNo/status', updateRoundStatus)
router.get('/events/:eventId/winners', getWinnersByEvent)
router.get('/winners/all', getAllWinners)
router.get('/events/:eventId/rounds/:roundNo/scoresheet', getScoreSheet)

export default router
