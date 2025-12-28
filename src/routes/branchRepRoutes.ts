import { Router } from 'express'
import { authenticateJWT } from '../middlewares/authMiddleware'
import { requireBranchRep } from '../middlewares/requireBranchRep'
import { validateRequest } from '../middlewares/validateRequest'
import {
  addOrganizerToEvent,
  createBranchRepEvent,
  deleteBranchEvent,
  listBranchRepEvents,
  getBranchEventDetails,
  updateBranchEvent,
  toggleBranchEventPublish,
  searchUsersForBranchRep,
  removeOrganizerFromEvent,
} from '../controllers/branchRepController'
import {
  addOrganizerSchema,
  createBranchEventSchema,
  publishBranchEventSchema,
  updateBranchEventSchema,
} from '../schemas/branchRepSchemas'

const router = Router()

router.use(authenticateJWT, requireBranchRep)

router.get('/events', listBranchRepEvents)
router.post('/events', validateRequest(createBranchEventSchema), createBranchRepEvent)
router.post('/events/:eventId/organizers', validateRequest(addOrganizerSchema), addOrganizerToEvent)
router.delete('/events/:eventId/organizers/:userId', removeOrganizerFromEvent)
router.delete('/events/:eventId', deleteBranchEvent)
router.get('/events/:eventId', getBranchEventDetails)
router.put('/events/:eventId', validateRequest(updateBranchEventSchema), updateBranchEvent)
router.post('/events/:eventId/publish', validateRequest(publishBranchEventSchema), toggleBranchEventPublish)
router.get('/users', searchUsersForBranchRep)

export default router
