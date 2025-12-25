import type { NextFunction, Request, Response } from 'express'
import type { ZodTypeAny } from 'zod'

export function validateRequest(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)

    if (!result.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: result.error.flatten().fieldErrors,
      })
    }

    // Attach parsed data for downstream handlers
    req.body = result.data
    return next()
  }
}
