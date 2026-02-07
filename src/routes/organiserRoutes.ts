import { Router } from 'express'
import {
  createTeam,
  deleteTeam,
  addTeamMember,
  removeTeamMember,
  listOrganiserEvents,
  getOrganiserEventDetails,
  searchUsers,
  markAttendance,
  createRound,
  deleteRound,
  addJudge,
  removeJudge,
  addCriteria,
  deleteCriteria,
  createQuiz,
  getQuiz,
  updateQuiz,
  deleteQuiz,
  getQuizLeaderboard,
  promoteParticipants,
  toggleEventStart,
  setActiveRound
} from '../controllers/organiserController'
import { authenticateJWT } from '../middlewares/authMiddleware'
import { requireOrganiser } from '../middlewares/requireOrganiser'
import { validateRequest } from '../middlewares/validateRequest'
import { createTeamSchema, addTeamMemberSchema, markAttendanceSchema, createQuizSchema, updateQuizSchema, updateOrganiserProfileSchema } from '../schemas/organiserSchemas'
import { updateOrganiserProfile } from '../controllers/organiserController'

const router = Router()

router.use(authenticateJWT)
router.use(requireOrganiser)

router.put('/profile', validateRequest(updateOrganiserProfileSchema), updateOrganiserProfile)
router.get('/events', listOrganiserEvents)
router.get('/events/:eventId', getOrganiserEventDetails)
router.post('/events/:eventId/teams', validateRequest(createTeamSchema), createTeam)
router.patch('/events/:eventId/toggle-start', toggleEventStart)
router.delete('/teams/:teamId', deleteTeam)
router.post('/teams/:teamId/members', validateRequest(addTeamMemberSchema), addTeamMember)
router.delete('/teams/:teamId/members/:userId', removeTeamMember)
router.get('/users/search', searchUsers)
router.post('/teams/:teamId/attendance', validateRequest(markAttendanceSchema), markAttendance)

router.post('/events/:eventId/rounds', createRound)
router.delete('/events/:eventId/rounds/:roundNo', deleteRound)

router.post('/events/:eventId/rounds/:roundNo/judges', addJudge)
router.delete('/events/:eventId/rounds/:roundNo/judges/:judgeUserId', removeJudge)

router.post('/events/:eventId/rounds/:roundNo/criteria', addCriteria)
router.delete('/events/:eventId/rounds/:roundNo/criteria/:criteriaId', deleteCriteria)

router.post('/events/:eventId/rounds/:roundId/quiz', validateRequest(createQuizSchema), createQuiz)
router.get('/events/:eventId/rounds/:roundId/quiz', getQuiz)
router.patch('/events/:eventId/quiz/:quizId', validateRequest(updateQuizSchema), updateQuiz)
router.delete('/events/:eventId/quiz/:quizId', deleteQuiz)
router.get('/events/:eventId/rounds/:roundId/quiz/leaderboard', getQuizLeaderboard)
router.post('/events/:eventId/rounds/:roundId/quiz/promote', promoteParticipants)
router.post('/events/:eventId/set-active-round', setActiveRound)

export default router
