import type { NextFunction, Response } from 'express'
import prisma from '../prisma/client'
import type { AuthenticatedRequest } from '../middlewares/authMiddleware'

export async function getCategories(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const categories = await prisma.emcCategory.findMany({
            orderBy: { name: 'asc' }
        })
        res.json({ categories })
    } catch (error) {
        next(error)
    }
}

export async function createCategory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const { name } = req.body
        if (!name) {
            res.status(400).json({ message: 'Name is required' })
            return
        }

        const category = await prisma.emcCategory.create({
            data: { name }
        })
        res.json({ category })
    } catch (error) {
        next(error)
    }
}
