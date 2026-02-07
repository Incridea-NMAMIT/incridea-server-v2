import type { NextFunction, Request, Response } from 'express'
import type { ZodTypeAny } from 'zod'

export function validateRequest(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)

    if (!result.success) {
      const errorMessages = result.error.issues.map((e) => e.message).join('. ')
      return res.status(400).json({
        message: errorMessages,
        errors: result.error.flatten().fieldErrors,
      })
    }

    req.body = result.data
    return next()
  }
}
