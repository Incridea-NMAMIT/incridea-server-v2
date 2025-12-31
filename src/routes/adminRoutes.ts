import { Router } from 'express'
import { authenticateJWT } from '../middlewares/authMiddleware'
import { requireAdmin } from '../middlewares/authorizeAdmin'
import { validateRequest } from '../middlewares/validateRequest'
import { getSettings, putSetting, getVariables, putVariable, getUsers, putUserRoles, getWebLogs } from '../controllers/adminController'
import { updateSettingSchema, upsertVariableSchema, updateUserRolesSchema } from '../schemas/adminSchemas'

const router = Router()

router.use(authenticateJWT, requireAdmin)

router.get('/settings', getSettings)
router.put('/settings/:key', validateRequest(updateSettingSchema), putSetting)

router.get('/variables', getVariables)
router.put('/variables/:key', validateRequest(upsertVariableSchema), putVariable)

router.get('/users', getUsers)
router.put('/users/:userId/roles', validateRequest(updateUserRolesSchema), putUserRoles)
router.get('/logs', getWebLogs)

export default router
