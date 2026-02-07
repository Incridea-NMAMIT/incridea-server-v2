import type { NextFunction, Response } from 'express'
import prisma from '../prisma/client'
import type { AuthenticatedRequest } from '../middlewares/authMiddleware'

export async function getVenues(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const venues = await prisma.venue.findMany({
            orderBy: { name: 'asc' },
        })
        return res.status(200).json({ venues })
    } catch (error) {
        return next(error)
    }
}

export async function createVenue(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const { name } = req.body

        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ message: 'Valid venue name is required' })
        }

        const existing = await prisma.venue.findUnique({
            where: { name: name.trim() }
        })

        if (existing) {
            return res.status(400).json({ message: 'Venue already exists' })
        }

        const venue = await prisma.venue.create({
            data: {
                name: name.trim()
            }
        })

        return res.status(201).json({ venue, message: 'Venue created successfully' })
    } catch (error) {
        return next(error)
    }
}

export async function deleteVenue(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const id = Number(req.params.id)
        if (!Number.isFinite(id)) {
            return res.status(400).json({ message: 'Invalid venue ID' })
        }


        await prisma.venue.delete({
            where: { id }
        })

        return res.status(200).json({ message: 'Venue deleted successfully' })
    } catch (error) {
        return next(error) 
    }
}
