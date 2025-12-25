import type { ErrorRequestHandler } from 'express'

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const statusCode = err.statusCode ?? 500
  const message = err.message ?? 'Internal Server Error'

  if (process.env.NODE_ENV !== 'production') {
    // Log stack trace in non-production
    // eslint-disable-next-line no-console
    console.error(err)
  }

  res.status(statusCode).json({
    message,
  })
}
