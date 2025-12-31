import { Router } from 'express'
import { authenticateJWT } from '../middlewares/authMiddleware'
import { requireAdmin } from '../middlewares/authorizeAdmin'
import { validateRequest } from '../middlewares/validateRequest'
import {
  applyToCommittee,
  assignCommitteeCoHead,
  assignCommitteeHead,
  approveCommitteeMember,
  getCommitteeState,
  searchCommitteeUsers,
} from '../controllers/committeeController'
import {
  applyCommitteeSchema,
  assignCoHeadSchema,
  assignHeadSchema,
  approveMemberSchema,
} from '../schemas/committeeSchemas'

const router = Router()

router.use(authenticateJWT)

router.get('/state', getCommitteeState)
router.get('/users', searchCommitteeUsers)
router.post('/apply', validateRequest(applyCommitteeSchema), applyToCommittee)
router.post('/assign-head', requireAdmin, validateRequest(assignHeadSchema), assignCommitteeHead)
router.post('/assign-cohead', validateRequest(assignCoHeadSchema), assignCommitteeCoHead)
router.post('/approve-member', validateRequest(approveMemberSchema), approveCommitteeMember)

export default router
