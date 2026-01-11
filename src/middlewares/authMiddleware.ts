import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../utils/env'

type JwtPayloadDecoded = jwt.JwtPayload & { sub?: string | number }

export interface AuthenticatedRequest extends Request {
  user?: { id: number }
}

export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1]

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as JwtPayloadDecoded
    const subject = decoded.sub
    const userId = typeof subject === 'string' ? Number(subject) : subject
    if (typeof userId !== 'number' || !Number.isFinite(userId)) {
      return res.status(401).json({ message: 'Invalid token payload' })
    }
    req.user = { id: userId }
    return next()
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}
