
import express, { Response, NextFunction } from 'express'
import { authenticateJWT, AuthenticatedRequest } from '../middlewares/authMiddleware'
import { requireAdmin } from '../middlewares/authorizeAdmin'
import * as proniteController from '../controllers/proniteController' 
import prisma from '../prisma/client'
import { ProniteDay } from '@prisma/client'

const router = express.Router()

// Middleware to check if user is a Pronite Volunteer for the CURRENT day
const authorizeProniteVolunteer = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' })
        
        // 1. Get Current Pronite Day
        const dayVar = await prisma.variable.findUnique({ where: { key: 'ProniteDay' } })
        if (!dayVar || !dayVar.value) {
            return res.status(403).json({ message: 'ProniteDay configuration missing' })
        }
        const currentDay = dayVar.value as ProniteDay
        
        // 2. Check if user is volunteer for this day
        const volunteer = await prisma.proniteVolunteer.findUnique({
            where: {
                userId_proniteDay: {
                    userId: req.user.id,
                    proniteDay: currentDay
                }
            }
        })

        if (!volunteer) {
             return res.status(403).json({ message: 'Not authorized as Pronite Volunteer for today' })
        }
        
        return next()
    } catch (error) {
        return next(error)
    }
}


// --- Admin Routes ---
router.post('/booth', authenticateJWT, requireAdmin, proniteController.createBooth)
router.get('/booth', authenticateJWT, requireAdmin, proniteController.getBooths)
router.put('/booth/:id', authenticateJWT, requireAdmin, proniteController.updateBooth)
router.delete('/booth/:id', authenticateJWT, requireAdmin, proniteController.deleteBooth)

router.post('/volunteer', authenticateJWT, requireAdmin, proniteController.assignVolunteer)
router.get('/volunteer', authenticateJWT, requireAdmin, proniteController.getAssignedVolunteers)
router.delete('/volunteer/:id', authenticateJWT, requireAdmin, proniteController.unassignVolunteer)
router.get('/users', authenticateJWT, requireAdmin, proniteController.searchUsers)



// --- Volunteer Routes ---
router.get('/status', authenticateJWT, proniteController.getVolunteerStatus)
router.get('/user/:pid', authenticateJWT, authorizeProniteVolunteer, proniteController.getUserByPid)
router.post('/scan', authenticateJWT, authorizeProniteVolunteer, proniteController.scanUser)

export default router
