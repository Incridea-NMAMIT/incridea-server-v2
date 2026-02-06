import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../utils/env'
import prisma from '../prisma/client'

type JwtPayloadDecoded = jwt.JwtPayload & { sub?: string | number, sessionId?: string }

export interface AuthenticatedRequest extends Request {
  user?: { id: number; sessionId?: string }
}

export async function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Strictly enforce cookie usage
  const tokenToVerify = req.cookies?.token

  if (!tokenToVerify) {
    return res.status(401).json({ message: 'Unauthorized: No session cookie' })
  }

  try {
    const decoded = jwt.verify(tokenToVerify, env.jwtSecret) as JwtPayloadDecoded
    const subject = decoded.sub
    const userId = typeof subject === 'string' ? Number(subject) : subject
    const sessionId = decoded.sessionId

    if (typeof userId !== 'number' || !Number.isFinite(userId)) {
      return res.status(401).json({ message: 'Invalid token payload' })
    }

    // DB Session Check
    if (sessionId) {
      // If token has sessionId, it MUST exist in DB
      const session = await prisma.session.findUnique({
        where: { id: sessionId }
      })

      if (!session || session.userId !== userId) { // Check userId match for security
        return res.status(401).json({ message: 'Session expired or invalid' })
      }

      // Optional: Check expiration if you want strict DB expiration, 
      // though JWT expiration handles stateless part. 
      // We set session expiresAt in DB, let's check it.
      if (session.expiresAt < new Date()) {
        // Clean up expired session async
        await prisma.session.delete({ where: { id: sessionId } }).catch(() => { })
        return res.status(401).json({ message: 'Session expired' })
      }
    } else {
      // Strictly require sessionId in token
      return res.status(401).json({ message: 'Invalid session structure. Please login again.' })
    }

    req.user = { id: userId, sessionId }
    return next()
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}


export function requireRole(roles: string[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { UserRoles: true } // Ensure roles are fetched
      })

      if (!user) return res.status(401).json({ message: 'User not found' })

      const userRoles = user.UserRoles.map(r => r.role)
      const hasRole = roles.some(role => userRoles.includes(role as any))

      if (!hasRole) return res.status(403).json({ message: 'Forbidden' })

      return next()
    } catch (error) {
      return next(error)
    }
  }
}

