import { Router } from 'express'
import { authenticateJWT } from '../middlewares/authMiddleware'
import {
  registerSoloEvent,
  createTeam,
  joinTeam,
  getMyTeam,
  confirmTeam,
  leaveTeam,
  deleteTeam
} from '../controllers/registrationController'

const router = Router()

router.use(authenticateJWT)

router.post('/solo', registerSoloEvent)
router.post('/create-team', createTeam)
router.post('/join-team', joinTeam)
router.post('/confirm-team', confirmTeam)
router.post('/leave-team', leaveTeam)
router.post('/delete-team', deleteTeam)
router.get('/my-team/:eventId', getMyTeam)

export default router
