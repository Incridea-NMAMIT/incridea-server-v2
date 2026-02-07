import express from 'express'
import {
  getStats,
  updateVars,
  checkAvailability,
  createIndividualBooking,
  getBookings,
  getUserByPid
} from '../controllers/accommodationController'
import { authenticateJWT } from '../middlewares/authMiddleware'
import { RequestHandler } from 'express'

const router = express.Router()

router.get('/stats', authenticateJWT, getStats as unknown as RequestHandler)
router.get('/check-availability', authenticateJWT, checkAvailability as unknown as RequestHandler)
router.post('/book/individual', authenticateJWT, createIndividualBooking as unknown as RequestHandler)


router.post(
  '/vars',
  authenticateJWT,
  updateVars as unknown as RequestHandler
)

router.get(
  '/admin/bookings',
  authenticateJWT,
  getBookings as unknown as RequestHandler
)

router.get('/user/:pid', authenticateJWT, getUserByPid as unknown as RequestHandler)

export default router
