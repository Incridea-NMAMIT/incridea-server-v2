import type { NextFunction, Response } from 'express'
import { getUserById } from '../services/authService'
import type { AuthenticatedRequest } from './authMiddleware'

export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const user = await getUserById(req.user.id)
    const hasAdminRole = Array.isArray(user.UserRoles)
      ? user.UserRoles.some((r) => r.role === 'ADMIN')
      : false

    if (!hasAdminRole) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    return next()
  } catch (error) {
    return next(error)
  }
}
