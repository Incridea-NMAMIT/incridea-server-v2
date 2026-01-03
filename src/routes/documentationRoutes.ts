import { Router } from 'express'
import { authenticateJWT } from '../middlewares/authMiddleware'
import { requireDocumentation } from '../middlewares/requireDocumentation'
import { validateRequest } from '../middlewares/validateRequest'
import {
    createDocumentationEvent,
    getBranches,
    getDocumentationEventDetails,
    listDocumentationEvents,
    updateDocumentationEvent,
    searchUsersForDocumentation,
    addOrganiserToEvent,
    removeOrganiserFromEvent,
} from '../controllers/documentationController'
import { createDocumentationEventSchema, updateDocumentationEventSchema } from '../schemas/documentationSchemas'

const router = Router()

router.use(authenticateJWT, requireDocumentation)

router.get('/events', listDocumentationEvents)
router.post('/events', validateRequest(createDocumentationEventSchema), createDocumentationEvent)
router.get('/events/:eventId', getDocumentationEventDetails)
router.put('/events/:eventId', validateRequest(updateDocumentationEventSchema), updateDocumentationEvent)
router.get('/branches', getBranches)
router.get('/users', searchUsersForDocumentation)
router.post('/events/:eventId/organisers', addOrganiserToEvent)
router.delete('/events/:eventId/organisers/:userId', removeOrganiserFromEvent)

router.post('/branches', validateRequest(createDocumentationEventSchema.pick({ name: true })), require('../controllers/documentationController').createBranch)
router.delete('/branches/:branchId', require('../controllers/documentationController').deleteBranch)
router.post('/branches/:branchId/reps', require('../controllers/documentationController').addBranchRep)
router.delete('/branches/:branchId/reps/:userId', require('../controllers/documentationController').removeBranchRep)

export default router
