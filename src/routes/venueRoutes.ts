import { Router } from 'express'
import { authenticateJWT, requireRole } from '../middlewares/authMiddleware'
import { Role } from '@prisma/client'
import { createVenue, deleteVenue, getVenues } from '../controllers/venueController'

const router = Router()

router.use(authenticateJWT)

router.get('/', getVenues)

router.post('/', requireRole([Role.EMC, Role.ADMIN]), createVenue)
router.delete('/:id', requireRole([Role.EMC, Role.ADMIN]), deleteVenue)

export default router
