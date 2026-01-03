import type { NextFunction, Response } from 'express'
import prisma from '../prisma/client'
import type { AuthenticatedRequest } from './authMiddleware'

export async function requireOrganiser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const organiser = await prisma.organiser.findFirst({ where: { userId: req.user.id } })
    if (!organiser) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    return next()
  } catch (error) {
    return next(error)
  }
}
