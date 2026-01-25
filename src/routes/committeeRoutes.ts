import { Router } from 'express'
import { authenticateJWT } from '../middlewares/authMiddleware'
import { requireAdminOrDocumentation } from '../middlewares/authorizeAdmin'
import { validateRequest } from '../middlewares/validateRequest'
import {
  applyToCommittee,
  assignCommitteeCoHead,
  assignCommitteeHead,
  approveCommitteeMember,
  getCommitteeState,
  searchCommitteeUsers,
  removeCommitteeMember,
  getCommitteeMembers,
  exportAllCommitteeMembers,
  updateCommitteeAccess,
} from '../controllers/committeeController'
import {
  applyCommitteeSchema,
  assignCoHeadSchema,
  assignHeadSchema,
  approveMemberSchema,
  removeMemberSchema,
} from '../schemas/committeeSchemas'

const router = Router()

router.use(authenticateJWT)

router.get('/state', getCommitteeState)
router.get('/users', searchCommitteeUsers)
router.post('/apply', validateRequest(applyCommitteeSchema), applyToCommittee)
router.post('/assign-head', requireAdminOrDocumentation, validateRequest(assignHeadSchema), assignCommitteeHead)
router.post('/assign-cohead', validateRequest(assignCoHeadSchema), assignCommitteeCoHead)
router.post('/approve-member', validateRequest(approveMemberSchema), approveCommitteeMember)
router.post('/remove-member', validateRequest(removeMemberSchema), removeCommitteeMember)
router.get('/export-all', requireAdminOrDocumentation, exportAllCommitteeMembers)
router.get('/:committeeId/members', getCommitteeMembers)
router.patch('/access', requireAdminOrDocumentation, updateCommitteeAccess)

export default router
