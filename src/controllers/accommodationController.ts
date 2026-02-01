import type { Request, Response, NextFunction } from 'express'
import prisma from '../prisma/client'
import { Gender, PaymentType, Status, CommitteeName } from '@prisma/client'
import { z } from 'zod'
import { AuthenticatedRequest } from '../middlewares/authMiddleware'
import { razorpayAccommodation } from '../services/razorpay'
import { logWebEvent } from '../services/logService'

// Get available accommodation stats
export async function getStats(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const boysVar = await prisma.accommodationRequests.findUnique({ where: { key: 'BoysAccCount' } })
    const girlsVar = await prisma.accommodationRequests.findUnique({ where: { key: 'GirlsAccCount' } })

    // Default to 0 if not set
    const boysTotal = boysVar?.value || 0
    const girlsTotal = girlsVar?.value || 0

    // Count confirmed or pending bookings
    const boysBooked = await prisma.accommodationBooking.count({
      where: {
        accommodationType: Gender.MALE,
        PaymentOrder: {
          status: { in: [Status.SUCCESS, Status.PENDING] }
        }
      }
    })

    const girlsBooked = await prisma.accommodationBooking.count({
      where: {
        accommodationType: Gender.FEMALE,
        PaymentOrder: {
          status: { in: [Status.SUCCESS, Status.PENDING] }
        }
      }
    })

    return res.json({
      boys: { total: boysTotal, booked: boysBooked, available: Math.max(0, boysTotal - boysBooked) },
      girls: { total: girlsTotal, booked: girlsBooked, available: Math.max(0, girlsTotal - girlsBooked) }
    })
  } catch (error) {
    return next(error)
  }
}

// Update accommodation variables (Head/CoHead only)
export async function updateVars(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ message: 'Unauthorized' })

    // Check if user is Head or CoHead of ACCOMMODATION
    const committee = await prisma.committee.findUnique({
      where: { name: CommitteeName.ACCOMMODATION }
    })

    if (!committee || (committee.headUserId !== userId && committee.coHeadUserId !== userId)) {
      // Allow Admin/Organizer fallback if needed, but strict req says Head/CoHead.
      // Let's check for Admin as well just in case.
      const userRole = await prisma.userRole.findFirst({
        where: { userId, role: 'ADMIN' }
      })
      if (!userRole) {
        return res.status(403).json({ message: 'Forbidden: Accommodation Head/CoHead access only' })
      }
    }

    const { boysCount, girlsCount } = req.body

    if (boysCount !== undefined) {
      await prisma.accommodationRequests.upsert({
        where: { key: 'BoysAccCount' },
        update: { value: boysCount },
        create: { key: 'BoysAccCount', value: boysCount }
      })
    }

    if (girlsCount !== undefined) {
      await prisma.accommodationRequests.upsert({
        where: { key: 'GirlsAccCount' },
        update: { value: girlsCount },
        create: { key: 'GirlsAccCount', value: girlsCount }
      })
    }

    void logWebEvent({
      message: `Accommodation variables updated (Boys: ${boysCount}, Girls: ${girlsCount})`,
      userId
    })

    return res.json({ message: 'Accommodation variables updated successfully' })
  } catch (error) {
    return next(error)
  }
}

// Check availability for a specific gender
export async function checkAvailability(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { gender } = req.query
    if (!gender || (gender !== 'MALE' && gender !== 'FEMALE')) {
      return res.status(400).json({ message: 'Invalid gender' })
    }

    const key = gender === 'MALE' ? 'BoysAccCount' : 'GirlsAccCount'
    const totalVar = await prisma.accommodationRequests.findUnique({ where: { key } })
    const total = totalVar?.value || 0

    const booked = await prisma.accommodationBooking.count({
      where: {
        accommodationType: gender as Gender,
        PaymentOrder: {
          status: { in: [Status.SUCCESS, Status.PENDING] }
        }
      }
    })

    return res.json({ available: total > booked, count: Math.max(0, total - booked) })
  } catch (error) {
    return next(error)
  }
}


// Create Booking (Individual)
export async function createIndividualBooking(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ message: 'Unauthorized' })

    const schema = z.object({
      checkIn: z.enum(['2026-03-05', '2026-03-06', '2026-03-07']),
      checkOut: z.enum(['2026-03-05', '2026-03-06', '2026-03-07']),
      idCard: z.string().url(),
    }).refine((data) => data.checkOut >= data.checkIn, {
      message: "Check-out date must be after or equal to check-in date",
      path: ["checkOut"],
    })

    const body = schema.parse(req.body)

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { gender: true }
    })
    if (!user || !user.gender) {
      return res.status(400).json({ message: 'User gender not found. Please update your profile.' })
    }

    const gender = user.gender

    // Check availability again (race condition mitigation)
    const key = gender === 'MALE' ? 'BoysAccCount' : 'GirlsAccCount'
    const totalVar = await prisma.accommodationRequests.findUnique({ where: { key } })
    const total = totalVar?.value || 0
    const booked = await prisma.accommodationBooking.count({
      where: {
        accommodationType: gender,
        PaymentOrder: {
          status: { in: [Status.SUCCESS, Status.PENDING] }
        }
      }
    })

    if (booked >= total) {
      return res.status(400).json({ message: 'Accommodation full for this gender' })
    }

    // Get PID for user
    const pid = await prisma.pID.findUnique({ where: { userId }, select: { id: true, pidCode: true } })
    if (!pid) {
      return res.status(400).json({ message: 'PID not found for user. Please register for the fest first.' })
    }

    const existingBooking = await prisma.accommodationBooking.findFirst({
      where: {
        pidId: pid.id,
        PaymentOrder: {
          status: { in: [Status.SUCCESS, Status.PENDING] }
        }
      }
    })

    if (existingBooking) {
      return res.status(400).json({ message: 'You have already registered. Please check email for receipt which serves as proof of payment' })
    }

    // Create Booking and Payment Order
    const booking = await prisma.$transaction(async (tx) => {
      const amount = 200
      const amountInRupees = Math.ceil(amount / (1 - 0.0236))
      const amountInPaisa = amountInRupees * 100

      // Create Razorpay Order with Accommodation credentials
      const order = await razorpayAccommodation.orders.create({
        amount: amountInPaisa,
        currency: 'INR',
        receipt: `acc_ind_${userId}_${Date.now()}`,
        notes: {
          type: PaymentType.ACC_REGISTRATION,
          userId: String(userId),
          bookingType: 'INDIVIDUAL',
          pid: pid.pidCode
        }
      })

      if (!order) throw new Error('Failed to create payment order')
      const orderId = order.id

      // Save to PaymentOrder table instead of AccommodationPayment
      await tx.paymentOrder.create({
        data: {
          orderId: order.id,
          amount: amount,
          collectedAmount: amountInRupees,
          status: Status.PENDING,
          type: PaymentType.ACC_REGISTRATION,
          userId,
          PID: pid.pidCode,
          paymentDataJson: order as any
        }
      })

      const booking = await tx.accommodationBooking.create({
        data: {
          pidId: pid.id,
          accommodationType: gender,
          checkIn: new Date(body.checkIn),
          checkOut: new Date(body.checkOut),
          idCard: body.idCard,

          paymentOrderId: order.id
        }
      })

      return { booking, payment: { ...booking, key: process.env.RAZORPAY_SEC_KEY_ID, currency: order.currency, amount: order.amount, orderId: orderId } }
    })

    void logWebEvent({
      message: `User ${userId} created accommodation booking`,
      userId
    })

    return res.json(booking)
  } catch (error) {
    return next(error)
  }
}


// Get Bookings (Admin)
export async function getBookings(req: Request, res: Response, next: NextFunction) {
  try {
    const { page = 1, limit = 10, search, status, gender } = req.query
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = {}
    if (status) where.PaymentOrder = { status: status }
    if (gender) where.accommodationType = gender
    if (search) {
      where.PID = {
        User: {
          OR: [
            { name: { contains: String(search), mode: 'insensitive' } },
            { email: { contains: String(search), mode: 'insensitive' } },
            { phoneNumber: { contains: String(search), mode: 'insensitive' } }
          ]
        }
      }
    }

    const bookings = await prisma.accommodationBooking.findMany({
      where,
      include: {
        PID: {
          include: {
            User: {
              select: { name: true, email: true, phoneNumber: true, collegeId: true, College: { select: { name: true } } }
            }
          }
        },
        PaymentOrder: true
      },
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' }
    })

    const total = await prisma.accommodationBooking.count({ where })

    return res.json({ bookings, total, pages: Math.ceil(total / Number(limit)) })
  } catch (error) {
    return next(error)
  }
}

// Get user by PID
export async function getUserByPid(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { pid } = req.params
    if (!pid) return res.status(400).json({ message: 'PID is required' })

    const pidRecord = await prisma.pID.findUnique({
      where: { pidCode: pid },
      include: {
        User: {
          select: {
            name: true,
            email: true,
            phoneNumber: true,
            gender: true,
            collegeId: true
          }
        }
      }
    })

    if (!pidRecord || !pidRecord.User) {
      return res.status(404).json({ message: 'User not found' })
    }

    return res.json(pidRecord.User)
  } catch (error) {
    return next(error)
  }
}
