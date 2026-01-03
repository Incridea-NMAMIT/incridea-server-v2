import type { NextFunction, Response } from 'express'
import prisma from '../prisma/client'
import type { AuthenticatedRequest } from '../middlewares/authMiddleware'
import type { CreateDocumentationEventInput, UpdateDocumentationEventInput } from '../schemas/documentationSchemas'
import { logWebEvent } from '../services/logService'

export function ensureAuthUser(req: AuthenticatedRequest, res: Response) {
    if (!req.user?.id) {
        res.status(401).json({ message: 'Unauthorized' })
        return null
    }
    return req.user.id
}

export async function listDocumentationEvents(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        // List all events
        const events = await prisma.event.findMany({
            orderBy: [{ published: 'desc' }, { name: 'asc' }],
            include: {
                Branch: true,
                Organisers: {
                    include: {
                        User: { select: { id: true, name: true, email: true, phoneNumber: true } },
                    },
                },
            },
        })

        return res.status(200).json({
            events: events.map((event) => ({
                ...event,
                branchName: event.Branch?.name ?? '',
                organisers: event.Organisers.map((org) => ({
                    userId: org.userId,
                    name: org.User.name,
                    email: org.User.email,
                })),
            })),
        })
    } catch (error) {
        return next(error)
    }
}

export async function createDocumentationEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const userId = ensureAuthUser(req, res)
        if (!userId) return

        const payload = req.body as CreateDocumentationEventInput

        const event = await prisma.event.create({
            data: {
                ...payload,
            },
        })

        void logWebEvent({
            message: `Documentation created event ${event.name} (${event.id})`,
            userId,
        })

        return res.status(201).json({ event })
    } catch (error) {
        return next(error)
    }
}

export async function getDocumentationEventDetails(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const eventId = Number(req.params.eventId)
        if (!Number.isFinite(eventId)) {
            return res.status(400).json({ message: 'Invalid event id' })
        }

        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: {
                Branch: true,
                Organisers: {
                    include: {
                        User: { select: { id: true, name: true, email: true, phoneNumber: true } },
                    },
                },
            },
        })

        if (!event) {
            return res.status(404).json({ message: 'Event not found' })
        }

        return res.status(200).json({
            event: {
                ...event,
                branchName: event.Branch?.name ?? '',
                organisers: event.Organisers.map((org) => ({
                    userId: org.userId,
                    name: org.User.name,
                    email: org.User.email,
                })),
            },
        })
    } catch (error) {
        return next(error)
    }
}

export async function updateDocumentationEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const userId = ensureAuthUser(req, res)
        if (!userId) return

        const eventId = Number(req.params.eventId)
        if (!Number.isFinite(eventId)) {
            return res.status(400).json({ message: 'Invalid event id' })
        }

        const payload = req.body as UpdateDocumentationEventInput

        const event = await prisma.event.findUnique({ where: { id: eventId } })
        if (!event) {
            return res.status(404).json({ message: 'Event not found' })
        }

        const updated = await prisma.event.update({
            where: { id: eventId },
            data: payload,
        })

        void logWebEvent({
            message: `Documentation updated event ${eventId}`,
            userId,
        })

        return res.status(200).json({ event: updated })
    } catch (error) {
        return next(error)
    }
}

export async function getBranches(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const branches = await prisma.branch.findMany({
            orderBy: { name: 'asc' },
            include: {
                BranchReps: {
                    include: {
                        User: {
                             select: { id: true, name: true, email: true, phoneNumber: true }
                        }
                    }
                }
            }
        })
        return res.status(200).json({ 
            branches: branches.map(b => ({
                id: b.id, 
                name: b.name,
                reps: b.BranchReps.map(r => ({
                    id: r.id,
                    userId: r.userId,
                    name: r.User.name,
                    email: r.User.email,
                    phoneNumber: r.User.phoneNumber
                }))
            })) 
        })
    } catch (error) {
        return next(error)
    }
}

export async function searchUsersForDocumentation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const userId = ensureAuthUser(req, res)
        if (!userId) return

        const query = (req.query.q as string | undefined)?.trim()
        if (!query || query.length < 2) {
            return res.status(200).json({ users: [] })
        }

        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { email: { contains: query, mode: 'insensitive' } },
                    { name: { contains: query, mode: 'insensitive' } },
                ],
            },
            take: 10,
            select: { id: true, name: true, email: true, phoneNumber: true },
            orderBy: { name: 'asc' },
        })

        return res.status(200).json({ users })
    } catch (error) {
        return next(error)
    }
}

export async function addOrganiserToEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const userId = ensureAuthUser(req, res)
        if (!userId) return

        const eventId = Number(req.params.eventId)
        if (!Number.isFinite(eventId)) {
            return res.status(400).json({ message: 'Invalid event id' })
        }

        const { email } = req.body as { email: string }
        if (!email) {
            return res.status(400).json({ message: 'Email is required' })
        }

        const event = await prisma.event.findUnique({ where: { id: eventId } })
        if (!event) {
            return res.status(404).json({ message: 'Event not found' })
        }

        // Only allow adding organisers to branch events? The requirement says "assign user as the organiser for that event" where isBranch is true.
        // We can enforce isBranch true if strictly required, but generally documentation might want to assign organisers to any event.
        // User said "shows the list of events where isBranch is true and allow... to assign user". 
        // So I won't strictly block non-branch events in backend in case requirements evolve, but frontend will filter.

        const organiserUser = await prisma.user.findUnique({ where: { email } })
        if (!organiserUser) {
            return res.status(404).json({ message: 'User not found' })
        }

        const alreadyOrganiser = await prisma.organiser.findFirst({
            where: { eventId: event.id, userId: organiserUser.id },
        })
        if (alreadyOrganiser) {
            return res.status(400).json({ message: 'User is already an organiser for this event' })
        }

        const organiser = await prisma.organiser.create({
            data: { eventId: event.id, userId: organiserUser.id },
            select: { userId: true, User: { select: { name: true, email: true, phoneNumber: true } } },
        })

        void logWebEvent({
            message: `Documentation added organiser ${organiserUser.email} to event ${event.id}`,
            userId,
        })

        return res.status(201).json({
            organiser: {
                userId: organiser.userId,
                name: organiser.User?.name ?? '',
                email: organiser.User?.email ?? '',
                phoneNumber: organiser.User?.phoneNumber ?? '',
            },
        })
    } catch (error) {
        return next(error)
    }
}

export async function removeOrganiserFromEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const userId = ensureAuthUser(req, res)
        if (!userId) return

        const eventId = Number(req.params.eventId)
        const organiserUserId = Number(req.params.userId)
        if (!Number.isFinite(eventId) || !Number.isFinite(organiserUserId)) {
            return res.status(400).json({ message: 'Invalid event or organiser id' })
        }

        const event = await prisma.event.findUnique({ where: { id: eventId } })
        if (!event) {
            return res.status(404).json({ message: 'Event not found' })
        }

        const organiser = await prisma.organiser.findUnique({
            where: { userId_eventId: { eventId: event.id, userId: organiserUserId } },
        })
        if (!organiser) {
            return res.status(404).json({ message: 'Organiser not found for this event' })
        }

        await prisma.organiser.delete({ where: { id: organiser.id } })

        void logWebEvent({
            message: `Documentation removed organiser ${organiserUserId} from event ${event.id}`,
            userId,
        })

        return res.status(200).json({ message: 'Organiser removed' })
    } catch (error) {
        return next(error)
    }
}

export async function createBranch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const userId = ensureAuthUser(req, res)
        if (!userId) return

        const { name } = req.body as { name: string }

        const existing = await prisma.branch.findFirst({
            where: { name: { equals: name, mode: 'insensitive' } },
        })
        if (existing) {
            return res.status(409).json({ message: 'Branch already exists' })
        }

        const branch = await prisma.branch.create({
            data: { name },
        })

        void logWebEvent({
            message: `Documentation created branch ${branch.name}`,
            userId,
        })

        return res.status(201).json({ branch })
    } catch (error) {
        return next(error)
    }
}

export async function deleteBranch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const userId = ensureAuthUser(req, res)
        if (!userId) return

        const branchId = Number(req.params.branchId)
        if (!Number.isFinite(branchId)) {
            return res.status(400).json({ message: 'Invalid branch id' })
        }

        const branch = await prisma.branch.findUnique({ where: { id: branchId } })
        if (!branch) {
            return res.status(404).json({ message: 'Branch not found' })
        }

        await prisma.branch.delete({ where: { id: branchId } })

        void logWebEvent({
            message: `Documentation deleted branch ${branch.name} (${branchId})`,
            userId,
        })

        return res.status(200).json({ message: 'Branch deleted' })
    } catch (error) {
        return next(error)
    }
}

export async function addBranchRep(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const userId = ensureAuthUser(req, res)
        if (!userId) return

        const branchId = Number(req.params.branchId)
        if (!Number.isFinite(branchId)) {
            return res.status(400).json({ message: 'Invalid branch id' })
        }

        const { email } = req.body as { email: string }
        if (!email) return res.status(400).json({ message: 'Email is required' })

        const userToAdd = await prisma.user.findUnique({ where: { email } })
        if (!userToAdd) {
            return res.status(404).json({ message: 'User not found' })
        }

        // Check if user is already a branch rep for ANY branch?
        // Schema: unique([userId, branchId]). It doesn not enforce uniqueness on userId global.
        // However, a user typically represents one branch. 
        // For now, let's allow multiple unless requirements specify otherwise. But logic 'isBranchRep' boolean implies simply "is a rep".
        
        const existingRep = await prisma.branchRep.findUnique({
            where: { userId_branchId: { branchId, userId: userToAdd.id } },
        })
        if (existingRep) {
            return res.status(409).json({ message: 'User is already a rep for this branch' })
        }

        const rep = await prisma.branchRep.create({
            data: {
                branchId,
                userId: userToAdd.id,
            },
            include: { User: { select: { id: true, name: true, email: true, phoneNumber: true } } },
        })

        // Also update UserRoles to include DOCUMENTATION? no, they are just branch reps.
        // Or wait, is BranchRep role separate? 'isBranchRep' boolean in frontend.

        void logWebEvent({
            message: `Documentation added branch rep ${userToAdd.email} to branch ${branchId}`,
            userId,
        })

        return res.status(201).json({ rep: { ...rep, user: rep.User } })
    } catch (error) {
        return next(error)
    }
}

export async function removeBranchRep(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const userId = ensureAuthUser(req, res)
        if (!userId) return

        const branchId = Number(req.params.branchId)
        const repUserId = Number(req.params.userId)
        
        if (!Number.isFinite(branchId) || !Number.isFinite(repUserId)) {
            return res.status(400).json({ message: 'Invalid IDs' })
        }

        const rep = await prisma.branchRep.findUnique({
            where: { userId_branchId: { branchId, userId: repUserId } },
        })
        if (!rep) {
            return res.status(404).json({ message: 'Branch rep not found' })
        }

        await prisma.branchRep.delete({ where: { id: rep.id } })

        void logWebEvent({
            message: `Documentation removed branch rep ${repUserId} from branch ${branchId}`,
            userId,
        })

        return res.status(200).json({ message: 'Branch rep removed' })
    } catch (error) {
        return next(error)
    }
}
