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
                        Venue: true
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
                startDateTime: primarySchedule?.startTime ?? null,
                endDateTime: primarySchedule?.endTime ?? null,
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

export async function updateEventVenue(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const { eventId } = req.params
        const { venueId } = req.body

        if (!eventId || !venueId) {
            res.status(400).json({ message: 'Event ID and Venue ID are required' })
            return
        }

        const id = parseInt(eventId)
        const vId = parseInt(venueId)

        if (isNaN(id) || isNaN(vId)) {
            res.status(400).json({ message: 'Invalid IDs' })
            return
        }

        // Upsert schedule. If multiple schedules exist, this logic might be too simple, 
        // but assuming single schedule per event for now as per previous schema patterns.
        // If it doesn't exist, create it.

        // First check if any schedule exists
        const existingSchedule = await prisma.eventSchedule.findFirst({
            where: { eventId: id },
            orderBy: { id: 'asc' }
        })

        let updatedSchedule;

        if (existingSchedule) {
            updatedSchedule = await prisma.eventSchedule.update({
                where: { id: existingSchedule.id },
                data: {
                    venueId: vId,
                    venue: null // Clear legacy string if linking to Venue entity
                },
                include: { Venue: true }
            })
        } else {
            // Create new schedule with default day (Day1) if missing
            updatedSchedule = await prisma.eventSchedule.create({
                data: {
                    eventId: id,
                    venueId: vId,
                    day: 'Day1', // Default, should ideally be passed or inferred
                    venue: null
                },
                include: { Venue: true }
            })
        }

        return res.json({
            message: 'Venue updated successfully',
            event: {
                id,
                venue: updatedSchedule.Venue
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
        const { startDateTime, endDateTime } = req.body

        if (!eventId) {
            res.status(400).json({ message: 'Event ID is required' })
            return
        }

        const id = parseInt(eventId)
        if (isNaN(id)) {
            res.status(400).json({ message: 'Invalid Event ID' })
            return
        }

        // Logic similar to venue update
        const existingSchedule = await prisma.eventSchedule.findFirst({
            where: { eventId: id },
            orderBy: { id: 'asc' }
        })

        const start = startDateTime ? new Date(startDateTime) : undefined
        const end = endDateTime ? new Date(endDateTime) : undefined

        let updatedSchedule;

        if (existingSchedule) {
            updatedSchedule = await prisma.eventSchedule.update({
                where: { id: existingSchedule.id },
                data: {
                    startTime: start,
                    endTime: end
                }
            })
        } else {
            updatedSchedule = await prisma.eventSchedule.create({
                data: {
                    eventId: id,
                    startTime: start,
                    endTime: end,
                    day: 'Day1', // Default
                    venue: null
                }
            })
        }

        return res.json({
            message: 'Timing updated successfully',
            event: {
                id,
                startDateTime: updatedSchedule.startTime,
                endDateTime: updatedSchedule.endTime
            }
        })

    } catch (error) {
        next(error)
        return
    }
}
