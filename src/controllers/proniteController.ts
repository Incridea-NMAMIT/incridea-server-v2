
import type { Request, Response, NextFunction } from 'express'
import prisma from '../prisma/client'
import { ProniteDay } from '@prisma/client'
import { AuthenticatedRequest } from '../middlewares/authMiddleware'
import { z } from 'zod'

// --- Schemas ---

const createBoothSchema = z.object({
  location: z.string().min(1),
  assignedBands: z.number().int().min(0).default(0),
})

const assignVolunteerSchema = z.object({
  userId: z.number().int(),
  boothId: z.number().int(),
  proniteDay: z.nativeEnum(ProniteDay),
})

const scanUserSchema = z.object({
  pid: z.string().min(1), // pidCode e.g. "INC26-1234"
})

// --- Controllers ---

export async function createBooth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { location, assignedBands } = createBoothSchema.parse(req.body)
    const booth = await prisma.proniteBooth.create({
      data: { location, assignedBands },
    })
    return res.status(201).json(booth)
  } catch (error) {
    return next(error)
  }
}

export async function updateBooth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid ID' })

    const { location, assignedBands } = createBoothSchema.parse(req.body)

    const booth = await prisma.proniteBooth.update({
      where: { id },
      data: { location, assignedBands }
    })
    return res.json(booth)
  } catch (error) {
    return next(error)
  }
}

export async function deleteBooth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid ID' })

    // Check for assigned volunteers
    const volunteerCount = await prisma.proniteVolunteer.count({ where: { boothId: id } })
    if (volunteerCount > 0) {
      return res.status(409).json({ message: 'Cannot delete booth with assigned volunteers. Unassign them first.' })
    }

    await prisma.proniteBooth.delete({ where: { id } })
    return res.json({ message: 'Booth deleted successfully' })
  } catch (error) {
    return next(error)
  }
}

export async function getBooths(_req: Request, res: Response, next: NextFunction) {
  try {
    const booths = await prisma.proniteBooth.findMany({
      include: {
        AssignedVolunteers: {
          include: {
            User: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      },
      orderBy: { id: 'asc' }
    })
    return res.json({ booths })
  } catch (error) {
    return next(error)
  }
}

export async function assignVolunteer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { userId, boothId, proniteDay } = assignVolunteerSchema.parse(req.body)
    
    // Check if user is already assigned for that day?
    // Unique constraint @@unique([userId, proniteDay]) in schema handles this.
    
    const volunteer = await prisma.proniteVolunteer.create({
      data: {
        userId,
        boothId,
        proniteDay,
      },
      include: {
         User: { select: { id: true, name: true, email: true } },
         Booth: true
      }
    })
    
    return res.status(201).json({ volunteer })
  } catch (error) {
    return next(error)
  }
}

export async function getAssignedVolunteers(_req: Request, res: Response, next: NextFunction) {
    try {
        const volunteers = await prisma.proniteVolunteer.findMany({
            include: {
                User: { select: { id: true, name: true, email: true } },
                Booth: true
            },
            orderBy: { createdAt: 'desc' }
        })
        return res.json({ volunteers })
    } catch (error) {
        return next(error)
    }
}

export async function unassignVolunteer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const id = Number(req.params.id)
        if (isNaN(id)) return res.status(400).json({ message: 'Invalid ID' })

        await prisma.proniteVolunteer.delete({ where: { id } })
        return res.json({ message: 'Volunteer unassigned' })
    } catch (error) {
        return next(error)
    }
}


// --- Volunteer specific ---

export async function getUserByPid(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const pidCode = req.params.pid
    if (!pidCode) return res.status(400).json({ message: 'PID is required' })

    const pidEntry = await prisma.pID.findUnique({
      where: { pidCode },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            gender: true,
            collegeId: true,
            College: { select: { name: true } },
            profileImage: true
          }
        },
        PronitePasses: true 
      }
    })

    if (!pidEntry) {
      return res.status(404).json({ message: 'User not found' })
    }

    return res.json({ 
        user: {
            ...pidEntry.User,
            pid: pidCode,
            passes: pidEntry.PronitePasses
        }
    })
  } catch (error) {
    return next(error)
  }
}

export async function scanUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const { pid } = scanUserSchema.parse(req.body)
        const volunteerUserId = req.user!.id

        // 1. Get Current Pronite Day
        const dayVar = await prisma.variable.findUnique({ where: { key: 'ProniteDay' } })
        if (!dayVar || !dayVar.value) {
            return res.status(400).json({ message: 'ProniteDay variable not set' })
        }
        const currentDay = dayVar.value as ProniteDay
        
        // 2. Verify Volunteer Logic (Double check they are assigned for THIS day)
        // Although middleware checks this, good to be safe or needed for logging
        const volunteer = await prisma.proniteVolunteer.findUnique({
             where: {
                 userId_proniteDay: {
                     userId: volunteerUserId,
                     proniteDay: currentDay
                 }
             }
        })

        if (!volunteer) {
             return res.status(403).json({ message: 'You are not assigned as a volunteer for this day' })
        }


        // 3. Find PID
        const pidEntry = await prisma.pID.findUnique({ where: { pidCode: pid } })
        if (!pidEntry) {
            return res.status(404).json({ message: 'PID not found' })
        }

        // 4. Check if already scanned
        const existingPass = await prisma.pronitePass.findUnique({
            where: {
                userId_proniteDay: {
                    userId: pidEntry.userId,
                    proniteDay: currentDay
                }
            }
        })

        if (existingPass) {
            return res.status(409).json({ message: 'User already scanned for this day', pass: existingPass })
        }

        // 5. Create Pass
        const pass = await prisma.pronitePass.create({
            data: {
                proniteDay: currentDay,
                pidId: pidEntry.id,
                userId: pidEntry.userId,
                scannedByVolunteerId: volunteer.id
            }
        })

        return res.status(201).json({ message: 'Scan successful', pass })

    } catch (error) {
        return next(error)
    }
}

export async function searchUsers(req: Request, res: Response, next: NextFunction) {
    try {
        const q = req.query.q as string
        if (!q || q.length < 3) return res.json({ users: [] })

        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { email: { contains: q, mode: 'insensitive' } }
                ]
            },
            take: 10,
            select: { id: true, name: true, email: true, phoneNumber: true }
        })
        return res.json({ users })
    } catch (error) {
        return next(error)
    }
}

export async function getVolunteerStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const userId = req.user!.id
        
        // 1. Get Settings
        const dayVar = await prisma.variable.findUnique({ where: { key: 'ProniteDay' } })
        const scanningSetting = await prisma.setting.findUnique({ where: { key: 'startScanning' } })
        
        const currentDay = dayVar?.value as ProniteDay
        const isScanningEnabled = scanningSetting?.value ?? false

        if (!currentDay) {
            return res.json({ authorized: false, scanningEnabled: false, message: 'Pronite Day not configured' })
        }

        // 2. Check Authorization
        const volunteer = await prisma.proniteVolunteer.findUnique({
            where: {
                userId_proniteDay: {
                    userId,
                    proniteDay: currentDay
                }
            }
        })

        if (!volunteer) {
            return res.json({ authorized: false, scanningEnabled: isScanningEnabled, message: 'You are not a volunteer for today' })
        }

        return res.json({ 
            authorized: true, 
            scanningEnabled: isScanningEnabled,
            day: currentDay 
        })

    } catch (error) {
        return next(error)
    }
}
