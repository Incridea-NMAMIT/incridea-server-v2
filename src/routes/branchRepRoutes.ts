import { Router } from 'express'
import { authenticateJWT } from '../middlewares/authMiddleware'
import { requireBranchRep } from '../middlewares/requireBranchRep'
import { validateRequest } from '../middlewares/validateRequest'
import {
  addOrganiserToEvent,
  createBranchRepEvent,
  deleteBranchEvent,
  listBranchRepEvents,
  getBranchEventDetails,
  updateBranchEvent,
  toggleBranchEventPublish,
  searchUsersForBranchRep,
  removeOrganiserFromEvent,
} from '../controllers/branchRepController'
import {
  addOrganiserSchema,
  createBranchEventSchema,
  publishBranchEventSchema,
  updateBranchEventSchema,
} from '../schemas/branchRepSchemas'

const router = Router()

router.use(authenticateJWT, requireBranchRep)

router.get('/events', listBranchRepEvents)
router.post('/events', validateRequest(createBranchEventSchema), createBranchRepEvent)
router.post('/events/:eventId/organisers', validateRequest(addOrganiserSchema), addOrganiserToEvent)
router.delete('/events/:eventId/organisers/:userId', removeOrganiserFromEvent)
router.delete('/events/:eventId', deleteBranchEvent)
router.get('/events/:eventId', getBranchEventDetails)
router.put('/events/:eventId', validateRequest(updateBranchEventSchema), updateBranchEvent)
router.post('/events/:eventId/publish', validateRequest(publishBranchEventSchema), toggleBranchEventPublish)
router.get('/users', searchUsersForBranchRep)

export default router
