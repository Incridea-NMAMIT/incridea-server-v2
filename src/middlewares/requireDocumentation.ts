import type { NextFunction, Response } from 'express'
import prisma from '../prisma/client'
import type { AuthenticatedRequest } from './authMiddleware'

export async function requireDocumentation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ message: 'Unauthorized' })
        }

        // Check if user has DOCUMENTATION role
        const userRole = await prisma.userRole.findFirst({
            where: {
                userId: req.user.id,
                role: 'DOCUMENTATION',
            },
        })

        if (!userRole) {
            return res.status(403).json({ message: 'Forbidden: Requires DOCUMENTATION role' })
        }

        return next()
    } catch (error) {
        return next(error)
    }
}
