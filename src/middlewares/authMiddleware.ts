import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../utils/env'

interface JwtPayloadDecoded extends jwt.JwtPayload {
  sub: string
}

export interface AuthenticatedRequest extends Request {
  user?: { id: string }
}

export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as JwtPayloadDecoded
    req.user = { id: decoded.sub }
    return next()
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}
