import type { NextFunction, Response } from 'express'
import prisma from '../prisma/client'
import { DayType } from '@prisma/client'
import type { AuthenticatedRequest } from '../middlewares/authMiddleware'
import type {
  AddOrganiserInput,
  CreateBranchEventInput,
  PublishBranchEventInput,
  UpdateBranchEventInput,
} from '../schemas/branchRepSchemas'
import { logWebEvent } from '../services/logService'

export function ensureAuthUser(req: AuthenticatedRequest, res: Response) {
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
        description: true,
        Schedule: {
          select: { Venue: { select: { id: true, name: true } }, day: true, startTime: true, endTime: true },
        },
        minTeamSize: true,
        maxTeamSize: true,
        maxTeams: true,
        eventType: true,
        category: true,
        tier: true,
        published: true,
        image: true,
        Organisers: {
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
        description: event.description,
        venue: event.Schedule[0]?.Venue ?? null,
        schedules: event.Schedule,
        minTeamSize: event.minTeamSize,
        maxTeamSize: event.maxTeamSize,
        maxTeams: event.maxTeams,
        eventType: event.eventType,
        category: event.category,
        tier: event.tier,
        published: event.published,
        image: event.image,
        organisers: event.Organisers.map((org) => ({
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

    const schedulesData = payload.schedules && payload.schedules.length > 0
      ? await Promise.all(payload.schedules.map(async s => {
        let venueId: number | null = null
        if (s.venue) {
          const v = await prisma.venue.upsert({
            where: { name: s.venue },
            create: { name: s.venue },
            update: {}
          })
          venueId = v.id
        }
        return {
          venue: s.venue,
          venueId,
          day: s.day,
          startTime: s.startTime ? new Date(s.startTime) : null,
          endTime: s.endTime ? new Date(s.endTime) : null,
        }
      }))
      : await (async () => {
        let venueId: number | null = null
        if (payload.venue) {
          const v = await prisma.venue.upsert({
            where: { name: payload.venue },
            create: { name: payload.venue },
            update: {}
          })
          venueId = v.id
        }
        return [{
          venue: payload.venue,
          venueId,
          day: DayType.Day1, 
        }]
      })()

    const event = await prisma.event.create({
      data: {
        name: payload.name,
        description: payload.description,
        minTeamSize: payload.minTeamSize,
        maxTeamSize: payload.maxTeamSize,
        maxTeams: payload.maxTeams,
        eventType: payload.eventType,
        category: payload.category,
        tier: payload.tier,
        branchId: branchRep.branchId,
        Schedule: {
          create: schedulesData
        }
      },
      select: { id: true, name: true, eventType: true, published: true },
    })

    void logWebEvent({
      message: `BranchRep created event ${event.name} (${event.id})`,
      userId,
    })

    return res.status(201).json({ event })
  } catch (error) {
    return next(error)
  }
}

export async function addOrganiserToEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const payload = req.body as AddOrganiserInput
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

    const organiserUser = await prisma.user.findUnique({ where: { email: payload.email } })
    if (!organiserUser) {
      return res.status(404).json({ message: 'User not found' })
    }

    const alreadyOrganiser = await prisma.organiser.findFirst({
      where: { eventId: event.id, userId: organiserUser.id },
    })
    if (alreadyOrganiser) {
      return res.status(400).json({ message: 'User is already an organiser for this event' })
    }

    const currentOrganisersCount = await prisma.organiser.count({
      where: { eventId: event.id },
    })
    if (currentOrganisersCount >= 2) {
      return res.status(400).json({ message: 'Event cannot have more than 2 organisers' })
    }

    const organiser = await prisma.organiser.create({
      data: { eventId: event.id, userId: organiserUser.id },
      select: { userId: true, User: { select: { name: true, email: true, phoneNumber: true } } },
    })

    void logWebEvent({
      message: `BranchRep added organiser ${organiserUser.email} to event ${event.id}`,
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

export async function removeOrganiserFromEvent(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const eventId = Number(req.params.eventId)
    const organiserUserId = Number(req.params.userId)
    if (!Number.isFinite(eventId) || !Number.isFinite(organiserUserId)) {
      return res.status(400).json({ message: 'Invalid event or organiser id' })
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

    const organiser = await prisma.organiser.findUnique({
      where: { userId_eventId: { eventId: event.id, userId: organiserUserId } },
    })
    if (!organiser) {
      return res.status(404).json({ message: 'Organiser not found for this event' })
    }

    await prisma.organiser.delete({ where: { id: organiser.id } })

    void logWebEvent({
      message: `BranchRep removed organiser ${organiserUserId} from event ${event.id}`,
      userId,
    })

    return res.status(200).json({ message: 'Organiser removed' })
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

    void logWebEvent({
      message: `BranchRep deleted event ${event.id}`,
      userId,
    })

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
        Schedule: {
          select: { venue: true, day: true, startTime: true, endTime: true },
        },
        minTeamSize: true,
        maxTeamSize: true,
        maxTeams: true,
        eventType: true,
        category: true,
        tier: true,
        published: true,
        Organisers: {
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
        venue: event.Schedule[0]?.venue ?? null,
        schedules: event.Schedule,
        organisers: event.Organisers.map((org) => ({
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

    const { venue, schedules, ...eventData } = payload

    let scheduleUpdate: any = undefined

    if (schedules && schedules.length > 0) {
      scheduleUpdate = {
        deleteMany: {},
        create: schedules.map((s) => ({
          venue: s.venue,
          day: s.day,
          startTime: s.startTime ? new Date(s.startTime) : null,
          endTime: s.endTime ? new Date(s.endTime) : null,
        })),
      }
    } else if (venue !== undefined) {
      scheduleUpdate = {
        updateMany: {
          where: {},
          data: { venue },
        },
      }
    }

    const updated = await prisma.event.update({
      where: { id: event.id },
      data: {
        ...eventData,
        Schedule: scheduleUpdate,
      },
      select: {
        id: true,
        name: true,
        description: true,
        image: true,
        Schedule: {
          select: { venue: true, day: true, startTime: true, endTime: true },
        },
        minTeamSize: true,
        maxTeamSize: true,
        maxTeams: true,
        eventType: true,
        category: true,
        tier: true,
        published: true,
      },
    })

    void logWebEvent({
      message: `BranchRep updated event ${event.id}`,
      userId,
    })

    return res.status(200).json({
      event: {
        ...updated,
        venue: updated.Schedule[0]?.venue ?? null,
        schedules: updated.Schedule
      }
    })
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

    void logWebEvent({
      message: `BranchRep set publish=${publish} for event ${event.id}`,
      userId,
    })

    return res.status(200).json({ event: updated })
  } catch (error) {
    return next(error)
  }
}
