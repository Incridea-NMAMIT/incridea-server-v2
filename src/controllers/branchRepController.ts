import type { NextFunction, Response } from 'express'
import prisma from '../prisma/client'
import type { AuthenticatedRequest } from '../middlewares/authMiddleware'
import type {
  AddOrganizerInput,
  CreateBranchEventInput,
  PublishBranchEventInput,
  UpdateBranchEventInput,
} from '../schemas/branchRepSchemas'

function ensureAuthUser(req: AuthenticatedRequest, res: Response) {
  if (!req.user?.id) {
    res.status(401).json({ message: 'Unauthorized' })
    return null
  }
  return req.user.id
}

async function getBranchRepContext(userId: number) {
  return prisma.branchRep.findUnique({ where: { userId }, include: { Branch: true } })
}

export async function searchUsersForBranchRep(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const branchRep = await getBranchRepContext(userId)
    if (!branchRep) {
      return res.status(403).json({ message: 'Forbidden' })
    }

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
      take: 8,
      select: { id: true, name: true, email: true, phoneNumber: true },
      orderBy: { name: 'asc' },
    })

    return res.status(200).json({ users })
  } catch (error) {
    return next(error)
  }
}

export async function listBranchRepEvents(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const branchRep = await getBranchRepContext(userId)
    if (!branchRep) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    const events = await prisma.event.findMany({
      where: { branchId: branchRep.branchId },
      orderBy: [{ published: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        eventType: true,
        published: true,
        Organizers: {
          select: {
            userId: true,
            User: { select: { id: true, name: true, email: true, phoneNumber: true } },
          },
        },
      },
    })

    return res.status(200).json({
      branchId: branchRep.branchId,
      branchName: branchRep.Branch?.name ?? null,
      events: events.map((event) => ({
        id: event.id,
        name: event.name,
        eventType: event.eventType,
        published: event.published,
        organizers: event.Organizers.map((org) => ({
          userId: org.userId,
          name: org.User?.name ?? '',
          email: org.User?.email ?? '',
          phoneNumber: org.User?.phoneNumber ?? '',
        })),
      })),
    })
  } catch (error) {
    return next(error)
  }
}

export async function createBranchRepEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const payload = req.body as CreateBranchEventInput
    const branchRep = await getBranchRepContext(userId)
    if (!branchRep) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    const event = await prisma.event.create({
      data: {
        name: payload.name,
        eventType: payload.eventType,
        branchId: branchRep.branchId,
      },
      select: { id: true, name: true, eventType: true, published: true },
    })

    return res.status(201).json({ event })
  } catch (error) {
    return next(error)
  }
}

export async function addOrganizerToEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const payload = req.body as AddOrganizerInput
    const eventId = Number(req.params.eventId)
    if (!Number.isFinite(eventId)) {
      return res.status(400).json({ message: 'Invalid event id' })
    }

    const branchRep = await getBranchRepContext(userId)
    if (!branchRep) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, branchId: branchRep.branchId },
      select: { id: true },
    })
    if (!event) {
      return res.status(404).json({ message: 'Event not found for your branch' })
    }

    const organizerUser = await prisma.user.findUnique({ where: { email: payload.email } })
    if (!organizerUser) {
      return res.status(404).json({ message: 'User not found' })
    }

    const alreadyOrganizer = await prisma.organizer.findFirst({
      where: { eventId: event.id, userId: organizerUser.id },
    })
    if (alreadyOrganizer) {
      return res.status(400).json({ message: 'User is already an organizer for this event' })
    }

    const organizer = await prisma.organizer.create({
      data: { eventId: event.id, userId: organizerUser.id },
      select: { userId: true, User: { select: { name: true, email: true, phoneNumber: true } } },
    })

    return res.status(201).json({
      organizer: {
        userId: organizer.userId,
        name: organizer.User?.name ?? '',
        email: organizer.User?.email ?? '',
        phoneNumber: organizer.User?.phoneNumber ?? '',
      },
    })
  } catch (error) {
    return next(error)
  }
}

export async function removeOrganizerFromEvent(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const eventId = Number(req.params.eventId)
    const organizerUserId = Number(req.params.userId)
    if (!Number.isFinite(eventId) || !Number.isFinite(organizerUserId)) {
      return res.status(400).json({ message: 'Invalid event or organizer id' })
    }

    const branchRep = await getBranchRepContext(userId)
    if (!branchRep) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, branchId: branchRep.branchId },
      select: { id: true },
    })
    if (!event) {
      return res.status(404).json({ message: 'Event not found for your branch' })
    }

    const organizer = await prisma.organizer.findUnique({
      where: { userId_eventId: { eventId: event.id, userId: organizerUserId } },
    })
    if (!organizer) {
      return res.status(404).json({ message: 'Organizer not found for this event' })
    }

    await prisma.organizer.delete({ where: { id: organizer.id } })

    return res.status(200).json({ message: 'Organizer removed' })
  } catch (error) {
    return next(error)
  }
}

export async function deleteBranchEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const eventId = Number(req.params.eventId)
    if (!Number.isFinite(eventId)) {
      return res.status(400).json({ message: 'Invalid event id' })
    }

    const branchRep = await getBranchRepContext(userId)
    if (!branchRep) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, branchId: branchRep.branchId },
      select: { id: true, published: true },
    })

    if (!event) {
      return res.status(404).json({ message: 'Event not found for your branch' })
    }

    if (event.published) {
      return res.status(400).json({ message: 'Published events cannot be deleted' })
    }

    await prisma.event.delete({ where: { id: event.id } })

    return res.status(200).json({ message: 'Event deleted' })
  } catch (error) {
    return next(error)
  }
}

export async function getBranchEventDetails(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const eventId = Number(req.params.eventId)
    if (!Number.isFinite(eventId)) {
      return res.status(400).json({ message: 'Invalid event id' })
    }

    const branchRep = await getBranchRepContext(userId)
    if (!branchRep) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, branchId: branchRep.branchId },
      select: {
        id: true,
        name: true,
        description: true,
        image: true,
        fees: true,
        venue: true,
        minTeamSize: true,
        maxTeamSize: true,
        maxTeams: true,
        eventType: true,
        category: true,
        tier: true,
        published: true,
        Organizers: {
          select: {
            userId: true,
            User: { select: { id: true, name: true, email: true, phoneNumber: true } },
          },
        },
      },
    })

    if (!event) {
      return res.status(404).json({ message: 'Event not found for your branch' })
    }

    return res.status(200).json({
      event: {
        ...event,
        organizers: event.Organizers.map((org) => ({
          userId: org.userId,
          name: org.User?.name ?? '',
          email: org.User?.email ?? '',
          phoneNumber: org.User?.phoneNumber ?? '',
        })),
      },
    })
  } catch (error) {
    return next(error)
  }
}

export async function updateBranchEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const eventId = Number(req.params.eventId)
    if (!Number.isFinite(eventId)) {
      return res.status(400).json({ message: 'Invalid event id' })
    }

    const payload = req.body as UpdateBranchEventInput
    const branchRep = await getBranchRepContext(userId)
    if (!branchRep) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, branchId: branchRep.branchId },
      select: { id: true, published: true },
    })

    if (!event) {
      return res.status(404).json({ message: 'Event not found for your branch' })
    }

    if (event.published) {
      return res.status(400).json({ message: 'Published events cannot be edited' })
    }

    const updated = await prisma.event.update({
      where: { id: event.id },
      data: payload,
      select: {
        id: true,
        name: true,
        description: true,
        image: true,
        fees: true,
        venue: true,
        minTeamSize: true,
        maxTeamSize: true,
        maxTeams: true,
        eventType: true,
        category: true,
        tier: true,
        published: true,
      },
    })

    return res.status(200).json({ event: updated })
  } catch (error) {
    return next(error)
  }
}

export async function toggleBranchEventPublish(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const eventId = Number(req.params.eventId)
    if (!Number.isFinite(eventId)) {
      return res.status(400).json({ message: 'Invalid event id' })
    }

    const { publish } = req.body as PublishBranchEventInput
    const branchRep = await getBranchRepContext(userId)
    if (!branchRep) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, branchId: branchRep.branchId },
      select: { id: true, published: true },
    })

    if (!event) {
      return res.status(404).json({ message: 'Event not found for your branch' })
    }

    const updated = await prisma.event.update({
      where: { id: event.id },
      data: { published: publish },
      select: {
        id: true,
        name: true,
        published: true,
      },
    })

    return res.status(200).json({ event: updated })
  } catch (error) {
    return next(error)
  }
}
