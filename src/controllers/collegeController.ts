import type { Request, Response, NextFunction } from 'express'
import prisma from '../prisma/client'

export async function listColleges(_req: Request, res: Response, next: NextFunction) {
  try {
    const colleges = await prisma.college.findMany({
      orderBy: { id: 'asc' },
      select: {

        id: true,
        name: true,
        details: true,
        type: true,
      },
    })

    return res.json({ colleges })
  } catch (error) {
    return next(error)
  }
}
