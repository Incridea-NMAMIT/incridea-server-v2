import type { NextFunction, Response } from 'express'
import { CommitteeMembershipStatus, type CommitteeName } from '@prisma/client'
import type { AuthenticatedRequest } from '../middlewares/authMiddleware'
import prisma from '../prisma/client'
import { AppError } from '../utils/appError'
import type {
  ApplyCommitteeInput,
  ApproveMemberInput,
  AssignCoHeadInput,
  AssignHeadInput,
} from '../schemas/committeeSchemas'

const userSummarySelect = { id: true, name: true, email: true, phoneNumber: true }

async function getUserRoles(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { UserRoles: { select: { role: true } } },
  })
  return user?.UserRoles?.map((r) => r.role) ?? []
}

async function ensureUserFreeForCommittee(userId: number, allowedCommitteeId?: number) {
  const membership = await prisma.committeeMembership.findUnique({ where: { userId } })
  if (membership && membership.committeeId !== allowedCommitteeId) {
    throw new AppError('User is already part of another committee', 400)
  }

  const committeeAsHead = await prisma.committee.findFirst({ where: { headUserId: userId } })
  if (committeeAsHead && committeeAsHead.id !== allowedCommitteeId) {
    throw new AppError('User is already a head of another committee', 400)
  }

  const committeeAsCoHead = await prisma.committee.findFirst({ where: { coHeadUserId: userId } })
  if (committeeAsCoHead && committeeAsCoHead.id !== allowedCommitteeId) {
    throw new AppError('User is already a co-head of another committee', 400)
  }
}

export async function getCommitteeState(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' })
    }
    const userId = req.user.id

    const setting = await prisma.setting.findUnique({ where: { key: 'isCommitteeRegOpen' } })
    const isCommitteeRegOpen = Boolean(setting?.value)

    const committees = await prisma.committee.findMany({
      orderBy: { name: 'asc' },
      include: {
        headUser: { select: userSummarySelect },
        coHeadUser: { select: userSummarySelect },
        _count: { select: { Members: true } },
      },
    })

    const membership = await prisma.committeeMembership.findUnique({
      where: { userId },
      include: { Committee: true },
    })

    const headCommittee = committees.find((c) => c.headUserId === userId)
    const coHeadCommittee = committees.find((c) => c.coHeadUserId === userId)

    let myRole: 'HEAD' | 'CO_HEAD' | 'MEMBER' | null = null
    let myCommittee: { id: number; name: CommitteeName } | null = null
    let membershipStatus: CommitteeMembershipStatus | null = null

    if (headCommittee) {
      myRole = 'HEAD'
      myCommittee = { id: headCommittee.id, name: headCommittee.name }
      membershipStatus = CommitteeMembershipStatus.APPROVED
    } else if (coHeadCommittee) {
      myRole = 'CO_HEAD'
      myCommittee = { id: coHeadCommittee.id, name: coHeadCommittee.name }
      membershipStatus = CommitteeMembershipStatus.APPROVED
    } else if (membership) {
      myRole = 'MEMBER'
      myCommittee = { id: membership.committeeId, name: membership.Committee.name }
      membershipStatus = membership.status
    }

    let pendingApplicants: Array<{
      membershipId: number
      userId: number
      name: string | null
      email: string
      phoneNumber: string
      status: CommitteeMembershipStatus
    }> = []

    let approvedMembers: Array<{
      membershipId: number
      userId: number
      name: string | null
      email: string
      phoneNumber: string
      status: CommitteeMembershipStatus
    }> = []

    if (myRole === 'HEAD' && myCommittee) {
      const members = await prisma.committeeMembership.findMany({
        where: { committeeId: myCommittee.id },
        include: { User: { select: userSummarySelect } },
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      })

      pendingApplicants = members
        .filter((m) => m.status === CommitteeMembershipStatus.PENDING)
        .map((m) => ({
          membershipId: m.id,
          userId: m.userId,
          name: m.User?.name ?? null,
          email: m.User?.email ?? '',
          phoneNumber: m.User?.phoneNumber ?? '',
          status: m.status,
        }))

      approvedMembers = members
        .filter((m) => m.status === CommitteeMembershipStatus.APPROVED)
        .map((m) => ({
          membershipId: m.id,
          userId: m.userId,
          name: m.User?.name ?? null,
          email: m.User?.email ?? '',
          phoneNumber: m.User?.phoneNumber ?? '',
          status: m.status,
        }))
    }

    return res.status(200).json({
      isCommitteeRegOpen,
      committees: committees.map((committee) => ({
        id: committee.id,
        name: committee.name,
        head: committee.headUser
          ? { id: committee.headUser.id, name: committee.headUser.name, email: committee.headUser.email }
          : null,
        coHead: committee.coHeadUser
          ? { id: committee.coHeadUser.id, name: committee.coHeadUser.name, email: committee.coHeadUser.email }
          : null,
        memberCount: committee._count.Members,
      })),
      my: {
        role: myRole,
        committeeId: myCommittee?.id ?? null,
        committeeName: myCommittee?.name ?? null,
        status: membershipStatus,
      },
      pendingApplicants,
      approvedMembers,
    })
  } catch (error) {
    return next(error)
  }
}

export async function applyToCommittee(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const payload = req.body as ApplyCommitteeInput
    const userId = req.user.id

    const setting = await prisma.setting.findUnique({ where: { key: 'isCommitteeRegOpen' } })
    const isCommitteeRegOpen = Boolean(setting?.value)
    if (!isCommitteeRegOpen) {
      return res.status(403).json({ message: 'Committee registrations are closed' })
    }

    await ensureUserFreeForCommittee(userId)

    const committee = await prisma.committee.findUnique({ where: { name: payload.committee } })
    if (!committee) {
      return res.status(404).json({ message: 'Committee not found' })
    }

    const membership = await prisma.committeeMembership.create({
      data: {
        userId,
        committeeId: committee.id,
        status: CommitteeMembershipStatus.PENDING,
      },
      include: { Committee: true },
    })

    return res.status(201).json({
      membership: {
        id: membership.id,
        status: membership.status,
        committeeId: membership.committeeId,
        committeeName: membership.Committee.name,
      },
      message: 'Applied to committee',
    })
  } catch (error) {
    return next(error)
  }
}

export async function assignCommitteeHead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const payload = req.body as AssignHeadInput

    const committee = await prisma.committee.findUnique({ where: { name: payload.committee } })
    if (!committee) {
      return res.status(404).json({ message: 'Committee not found' })
    }

    const user = await prisma.user.findUnique({ where: { email: payload.email } })
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    await ensureUserFreeForCommittee(user.id, committee.id)

    await prisma.committeeMembership.deleteMany({ where: { userId: user.id, committeeId: committee.id } })

    const updated = await prisma.committee.update({
      where: { id: committee.id },
      data: {
        headUserId: user.id,
        coHeadUserId: committee.coHeadUserId === user.id ? null : committee.coHeadUserId,
      },
      include: {
        headUser: { select: userSummarySelect },
        coHeadUser: { select: userSummarySelect },
      },
    })

    return res.status(200).json({
      committee: {
        id: updated.id,
        name: updated.name,
        head: updated.headUser,
        coHead: updated.coHeadUser,
      },
      message: 'Head assigned',
    })
  } catch (error) {
    return next(error)
  }
}

export async function assignCommitteeCoHead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const payload = req.body as AssignCoHeadInput
    const userId = req.user.id

    const committee = await prisma.committee.findUnique({ where: { name: payload.committee } })
    if (!committee) {
      return res.status(404).json({ message: 'Committee not found' })
    }

    if (committee.headUserId !== userId) {
      return res.status(403).json({ message: 'Only the committee head can add a co-head' })
    }

    const user = await prisma.user.findUnique({ where: { email: payload.email } })
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    await ensureUserFreeForCommittee(user.id, committee.id)

    await prisma.$transaction(async (tx) => {
      await tx.committee.update({
        where: { id: committee.id },
        data: { coHeadUserId: user.id },
      })

      const existingMembership = await tx.committeeMembership.findUnique({ where: { userId: user.id } })
      if (existingMembership) {
        await tx.committeeMembership.update({
          where: { id: existingMembership.id },
          data: { status: CommitteeMembershipStatus.APPROVED, committeeId: committee.id },
        })
      } else {
        await tx.committeeMembership.create({
          data: {
            userId: user.id,
            committeeId: committee.id,
            status: CommitteeMembershipStatus.APPROVED,
          },
        })
      }
    })

    const updated = await prisma.committee.findUnique({
      where: { id: committee.id },
      include: {
        headUser: { select: userSummarySelect },
        coHeadUser: { select: userSummarySelect },
      },
    })

    return res.status(200).json({
      committee: {
        id: updated?.id ?? committee.id,
        name: updated?.name ?? committee.name,
        head: updated?.headUser ?? null,
        coHead: updated?.coHeadUser ?? null,
      },
      message: 'Co-head assigned',
    })
  } catch (error) {
    return next(error)
  }
}

export async function approveCommitteeMember(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const payload = req.body as ApproveMemberInput

    const membership = await prisma.committeeMembership.findUnique({
      where: { id: payload.membershipId },
      include: { Committee: true, User: { select: userSummarySelect } },
    })

    if (!membership) {
      return res.status(404).json({ message: 'Membership not found' })
    }

    if (membership.Committee.headUserId !== req.user.id) {
      return res.status(403).json({ message: 'Only the committee head can approve members' })
    }

    const updated = await prisma.committeeMembership.update({
      where: { id: membership.id },
      data: { status: CommitteeMembershipStatus.APPROVED },
      include: { User: { select: userSummarySelect } },
    })

    return res.status(200).json({
      membership: {
        id: updated.id,
        status: updated.status,
        user: updated.User,
      },
      message: 'Member approved',
    })
  } catch (error) {
    return next(error)
  }
}

export async function searchCommitteeUsers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const roles = await getUserRoles(req.user.id)
    const isAdmin = roles.includes('ADMIN')

    const headCommittee = await prisma.committee.findFirst({ where: { headUserId: req.user.id } })

    if (!isAdmin && !headCommittee) {
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
      orderBy: { name: 'asc' },
      select: userSummarySelect,
    })

    return res.status(200).json({ users })
  } catch (error) {
    return next(error)
  }
}
