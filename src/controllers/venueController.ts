import type { NextFunction, Response } from 'express'
import prisma from '../prisma/client'
import type { AuthenticatedRequest } from '../middlewares/authMiddleware'

export async function getVenues(req: AuthenticatedRequest, res: Response, next: NextFunction) {
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

        // Check for duplicates
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

        // Optional: Check if used in any EventSchedule before deleting? 
        // The relation is optional on EventSchedule, but deleting it might set it to null or fail if restrictive.
        // In schema: `Venue Venue? @relation(fields: [venueId], references: [id])` - default behavior is usually restrictive or SetNull?
        // User didn't specify cascade specific behavior for Venue->Schedule. Default Prisma is usually Restrict for 1-m if not specified or SetNull if optional.
        // Let's assume standard delete is fine.

        await prisma.venue.delete({
            where: { id }
        })

        return res.status(200).json({ message: 'Venue deleted successfully' })
    } catch (error) {
        return next(error) // Will handle 404/Constraint errors
    }
}
