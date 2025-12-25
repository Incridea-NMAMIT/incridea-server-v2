import type { Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from '../middlewares/authMiddleware'

export async function getProtectedResource(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    return res.json({
      message: 'Protected content accessible',
      userId: req.user?.id,
    })
  } catch (error) {
    return next(error)
  }
}
