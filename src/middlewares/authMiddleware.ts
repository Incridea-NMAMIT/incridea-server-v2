import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../utils/env'
import prisma from '../prisma/client'

type JwtPayloadDecoded = jwt.JwtPayload & { sub?: string | number, sessionId?: string }

export interface AuthenticatedRequest extends Request {
  user?: { id: number; sessionId?: string }
}

export async function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token

  // Removed fallback to Authorization header to enforce cookie usage as per plan
  // OR keep it but prioritize cookie. Plan said "cookie will be HttpOnly".
  // If we want to support mobile apps later, header might be useful, but for now enforcing cookie ensures logic consistency with the "not in sessionstorage" requirement.
  // However, existing code had fallback. I will keep fallback but valid session check is mandatory.

  const tokenToVerify = token || req.headers.authorization?.split(' ')[1]

  if (!tokenToVerify) {
    return res.status(401).json({ message: 'Unauthorized' })
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
             await prisma.session.delete({ where: { id: sessionId } }).catch(() => {})
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
