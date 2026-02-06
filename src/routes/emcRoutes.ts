import { Router } from 'express'
import { authenticateJWT, requireRole } from '../middlewares/authMiddleware'
import { Role } from '@prisma/client'
import { getAllEvents, updateEventVenue, updateEventTiming } from '../controllers/emcController'

const router = Router()

router.use(authenticateJWT)

// Allow EMC and ADMIN to access these routes
// If you want to allow other roles, adjust here.
// For now, assuming only EMC management needs this.
router.get('/events', getAllEvents)
router.patch('/events/:eventId/venue', requireRole([Role.EMC, Role.ADMIN]), updateEventVenue)
router.patch('/events/:eventId/timing', requireRole([Role.EMC, Role.ADMIN]), updateEventTiming)

export default router
