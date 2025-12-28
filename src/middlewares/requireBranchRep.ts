import type { NextFunction, Response } from 'express'
import prisma from '../prisma/client'
import type { AuthenticatedRequest } from './authMiddleware'

export async function requireBranchRep(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const branchRep = await prisma.branchRep.findUnique({ where: { userId: req.user.id } })
    if (!branchRep) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    return next()
  } catch (error) {
    return next(error)
  }
}
