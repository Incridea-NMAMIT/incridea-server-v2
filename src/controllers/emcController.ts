import type { NextFunction, Response } from 'express'
import prisma from '../prisma/client'
import type { AuthenticatedRequest } from '../middlewares/authMiddleware'

export async function getAllEvents(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const userId = req.user?.id
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' })
            return
        }

        // Check permissions (optional, but good practice if this is strictly EMC)
        // For now, assuming middleware handles general auth, but we might want to restrict this data 
        // to relevant roles if it contains sensitive data. Based on context, this is for operations dashboard.

        const events = await prisma.event.findMany({
            include: {
                Schedule: {
                    include: {
                        Venue: true,
                        venues: true
                    }
                },
                _count: {
                    select: {
                        EventParticipants: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        })

        // Map to frontend friendly format
        const formattedEvents = events.map(event => {
            // Use the first schedule for venue/timing info as per current frontend assumption
            // Ideally frontend should handle multiple schedules, but for now we flatten.
            const primarySchedule = event.Schedule[0]

            return {
                id: event.id,
                name: event.name,
                eventType: event.eventType,
                category: event.category,
                description: event.description,
                // Flattened fields for backward compatibility / ease of use in frontend
                venue: primarySchedule?.Venue ?? null,
                venues: primarySchedule?.venues ?? [],
                startDateTime: primarySchedule?.startTime ?? null,
                endDateTime: primarySchedule?.endTime ?? null,
                displayRow: primarySchedule?.displayRow ?? null,
                registrationCount: event._count.EventParticipants
            }
        })

        res.json({ events: formattedEvents })
        return

    } catch (error) {
        next(error)
        return
    }
}

// Helper to find schedule
async function findSchedule(id: number, type: string) {
    if (type === 'EMC') {
        return prisma.eventSchedule.findFirst({
            where: { emcEventId: id },
            orderBy: { id: 'asc' }
        })
    }
    return prisma.eventSchedule.findFirst({
        where: { eventId: id },
        orderBy: { id: 'asc' }
    })
}

export async function updateEventVenue(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const { eventId } = req.params
        const { venueId, venueIds, type } = req.body

        if (!eventId || (!venueId && !venueIds)) {
            res.status(400).json({ message: 'Event ID and Venue ID(s) are required' })
            return
        }

        const id = parseInt(eventId)
        let vIds: number[] = []

        if (venueIds && Array.isArray(venueIds)) {
            vIds = venueIds.map((v: any) => parseInt(v)).filter((v: number) => !isNaN(v))
        } else if (venueId) {
            const vId = parseInt(venueId)
            if (!isNaN(vId)) vIds.push(vId)
        }

        if (isNaN(id) || vIds.length === 0) {
            res.status(400).json({ message: 'Invalid IDs' })
            return
        }

        const existingSchedule = await findSchedule(id, type)

        let updatedSchedule;

        if (existingSchedule) {
            updatedSchedule = await prisma.eventSchedule.update({
                where: { id: existingSchedule.id },
                data: {
                    venues: { set: vIds.map(vid => ({ id: vid })) },
                    venueId: vIds.length > 0 ? vIds[0] : null,
                    venue: null
                },
                include: { venues: true, Venue: true }
            })
        } else {
            // Create new schedule logic
            const createData: any = {
                venues: { connect: vIds.map(vid => ({ id: vid })) },
                venueId: vIds.length > 0 ? vIds[0] : null,
                day: 'Day1',
                venue: null
            }
            if (type === 'EMC') createData.emcEventId = id
            else createData.eventId = id

            updatedSchedule = await prisma.eventSchedule.create({
                data: createData,
                include: { venues: true, Venue: true }
            })
        }

        return res.json({
            message: 'Venue updated successfully',
            event: {
                id,
                venue: updatedSchedule.Venue,
                venues: updatedSchedule.venues
            }
        })

    } catch (error) {
        next(error)
        return
    }
}

export async function updateEventTiming(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const { eventId } = req.params
        const { startDateTime, endDateTime, displayRow, type } = req.body

        if (!eventId) {
            res.status(400).json({ message: 'Event ID is required' })
            return
        }

        const id = parseInt(eventId)
        if (isNaN(id)) {
            res.status(400).json({ message: 'Invalid Event ID' })
            return
        }

        const existingSchedule = await findSchedule(id, type)
        const start = startDateTime ? new Date(startDateTime) : undefined
        const end = endDateTime ? new Date(endDateTime) : undefined

        let updatedSchedule;

        if (existingSchedule) {
            updatedSchedule = await prisma.eventSchedule.update({
                where: { id: existingSchedule.id },
                data: {
                    startTime: start,
                    endTime: end,
                    displayRow: displayRow !== undefined ? displayRow : undefined
                }
            })
        } else {
            const createData: any = {
                startTime: start,
                endTime: end,
                displayRow: displayRow !== undefined ? displayRow : null,
                day: 'Day1',
                venue: null
            }
            if (type === 'EMC') createData.emcEventId = id
            else createData.eventId = id

            updatedSchedule = await prisma.eventSchedule.create({
                data: createData
            })
        }

        return res.json({
            message: 'Timing updated successfully',
            event: {
                id,
                startDateTime: updatedSchedule.startTime,
                endDateTime: updatedSchedule.endTime,
                displayRow: updatedSchedule.displayRow
            }
        })

    } catch (error) {
        next(error)
        return
    }
}

// --- EMC Custom Events ---

export async function getEmcEvents(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const events = await prisma.emcEvent.findMany({
            include: {
                schedules: {
                    include: {
                        Venue: true,
                        venues: true
                    }
                },
                EmcCategory: true,
                Venue: true
            },
            orderBy: { createdAt: 'desc' }
        })

        const formattedEvents = events.map(event => {
            const primarySchedule = event.schedules[0]
            return {
                id: event.id,
                name: event.name,
                category: event.category ?? event.EmcCategory?.name ?? 'SPECIAL',
                venue: event.Venue ?? primarySchedule?.Venue ?? null,
                venues: primarySchedule?.venues ?? (event.Venue ? [event.Venue] : []),
                startDateTime: primarySchedule?.startTime ?? null,
                endDateTime: primarySchedule?.endTime ?? null,
                displayRow: primarySchedule?.displayRow ?? null,
                type: 'EMC'
            }
        })

        res.json({ events: formattedEvents })
    } catch (error) {
        next(error)
    }
}

export async function createEmcEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const { name, category, emcCategoryId, venueId } = req.body

        if (!name) {
            res.status(400).json({ message: 'Name is required' })
            return
        }

        const data: any = {
            name,
            venueId: venueId ? parseInt(venueId) : null,
            schedules: {
                create: {
                    day: 'Day1',
                    venueId: venueId ? parseInt(venueId) : null,
                    venues: venueId ? { connect: { id: parseInt(venueId) } } : undefined
                }
            }
        }

        if (emcCategoryId) {
            data.emcCategoryId = parseInt(emcCategoryId)
        } else if (category) {
            data.category = category
        }

        const event = await prisma.emcEvent.create({
            data,
            include: {
                Venue: true,
                EmcCategory: true,
                schedules: {
                    include: {
                        venues: true,
                        Venue: true
                    }
                }
            }
        })

        // Format for response
        const formatted = {
            id: event.id,
            name: event.name,
            category: event.category ?? event.EmcCategory?.name ?? 'SPECIAL',
            venue: event.Venue,
            venues: event.schedules[0]?.venues ?? (event.Venue ? [event.Venue] : []),
            startDateTime: null,
            endDateTime: null,
            displayRow: null,
            type: 'EMC'
        }

        res.json({ event: formatted })
    } catch (error) {
        next(error)
    }
}
