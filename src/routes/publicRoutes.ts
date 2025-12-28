import { Router } from 'express'
import {
	getPublishedEventById,
	getPublishedEvents,
	getRegistrationConfig,
} from '../controllers/publicController'

const router = Router()

router.get('/registration-config', getRegistrationConfig)
router.get('/events', getPublishedEvents)
router.get('/events/:id', getPublishedEventById)

export default router
