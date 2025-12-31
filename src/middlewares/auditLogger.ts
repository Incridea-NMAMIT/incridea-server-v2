import type { NextFunction, Response } from 'express'
import type { AuthenticatedRequest } from './authMiddleware'
import { logWebEvent } from '../services/logService'

const REDACT_KEYS = ['password', 'currentPassword', 'newPassword', 'otp', 'token']

function redact(body: unknown) {
  if (!body || typeof body !== 'object') return undefined
  const clone = { ...(body as Record<string, unknown>) }
  for (const key of REDACT_KEYS) {
    if (key in clone) {
      clone[key] = '[REDACTED]'
    }
  }
  return clone
}

export function auditLogger(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const start = Date.now()
  res.on('finish', () => {
    const method = req.method.toUpperCase()
    if (method === 'GET') {
      return
    }

    if (req.originalUrl?.startsWith('/health')) {
      return
    }

    const durationMs = Date.now() - start
    const message = `${method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`
    void logWebEvent({ message, userId: req.user?.id ?? null }, {
      body: redact(req.body),
      query: req.query,
    })
  })

  next()
}
