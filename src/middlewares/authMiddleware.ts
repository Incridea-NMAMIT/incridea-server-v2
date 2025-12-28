import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../utils/env'

type JwtPayloadDecoded = jwt.JwtPayload & { sub?: string | number }

export interface AuthenticatedRequest extends Request {
  user?: { id: number }
}

export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const token = authHeader.split(' ')[1]

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
