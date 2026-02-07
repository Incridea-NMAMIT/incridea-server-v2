import { Request, Response, NextFunction } from 'express'

export function auditLogger(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET') {
    return next()
  }

  res.on('finish', () => {
    if (req.originalUrl?.startsWith('/health')) {
      return
    }

  })

  next()
}
