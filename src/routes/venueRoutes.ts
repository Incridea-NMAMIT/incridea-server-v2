import { Router } from 'express'
import { authenticateJWT, requireRole } from '../middlewares/authMiddleware'
import { Role } from '@prisma/client'
import { createVenue, deleteVenue, getVenues } from '../controllers/venueController'

const router = Router()

// All venue routes require authentication
router.use(authenticateJWT)

// Get all venues - Accessible to any auth user (or restrict to internal?)
router.get('/', getVenues)

// Create/Delete - Restricted to EMC and ADMIN
router.post('/', requireRole([Role.EMC, Role.ADMIN]), createVenue)
router.delete('/:id', requireRole([Role.EMC, Role.ADMIN]), deleteVenue)

export default router
