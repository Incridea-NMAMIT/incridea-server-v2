import { Router } from 'express'
import { authenticateJWT, requireRole } from '../middlewares/authMiddleware'
import { Role } from '@prisma/client'
import { getAllEvents, updateEventVenue, updateEventTiming, getEmcEvents, createEmcEvent, deleteEventSchedule } from '../controllers/emcController'
import { getCategories, createCategory } from '../controllers/emcCategoryController'

const router = Router()

router.use(authenticateJWT)

router.get('/events', getAllEvents)
router.patch('/events/:eventId/venue', requireRole([Role.EMC, Role.ADMIN]), updateEventVenue)
router.patch('/events/:eventId/timing', requireRole([Role.EMC, Role.ADMIN]), updateEventTiming)

router.get('/custom-events', getEmcEvents)
router.post('/custom-events', requireRole([Role.EMC, Role.ADMIN]), createEmcEvent)

router.get('/categories', getCategories)
router.post('/categories', requireRole([Role.EMC, Role.ADMIN]), createCategory)

router.delete('/schedules/:scheduleId', requireRole([Role.EMC, Role.ADMIN]), deleteEventSchedule)

export default router
