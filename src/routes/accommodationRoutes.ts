import express from 'express'
import {
  getStats,
  updateVars,
  checkAvailability,
  createIndividualBooking,
  createTeamBooking,
  getBookings
} from '../controllers/accommodationController'
import { authenticateJWT, AuthenticatedRequest } from '../middlewares/authMiddleware'
import { RequestHandler } from 'express'

const router = express.Router()

// Public/Authenticated User Routes
router.get('/stats', authenticateJWT, getStats as unknown as RequestHandler) 
router.get('/check-availability', authenticateJWT, checkAvailability as unknown as RequestHandler)
router.post('/book/individual', authenticateJWT, createIndividualBooking as unknown as RequestHandler)
router.post('/book/team', authenticateJWT, createTeamBooking as unknown as RequestHandler)

// Admin/Committee Application Routes
// Only Head/CoHead of ACCOMMODATION can manage
router.post(
    '/vars',
    authenticateJWT,
    updateVars as unknown as RequestHandler
)

 router.get(
     '/admin/bookings',
     authenticateJWT,
     // Add proper role check here. For now assume verifyAuth + manual check in controller or specific middleware
     getBookings as unknown as RequestHandler
 )

export default router
