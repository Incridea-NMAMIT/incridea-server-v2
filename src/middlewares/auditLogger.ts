import { Request, Response, NextFunction } from 'express'

export function auditLogger(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET') {
    return next()
  }

  res.on('finish', () => {
    if (req.originalUrl?.startsWith('/health')) {
      return
    }

    // const durationMs = Date.now() - start
    // const message = `${method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`
    // Logging removed as per requirement
  })

  next()
}
