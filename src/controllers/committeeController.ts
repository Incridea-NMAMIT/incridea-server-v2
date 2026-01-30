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
  RemoveMemberInput,
} from '../schemas/committeeSchemas'

const userSummarySelect = { id: true, name: true, email: true, phoneNumber: true, profileImage: true }

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

  // ALLOW USER TO BE HEAD OF MULTIPLE COMMITTEES - Checks removed
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
        _count: { select: { Members: { where: { status: CommitteeMembershipStatus.APPROVED } } } },
      },
    })

    const membership = await prisma.committeeMembership.findUnique({
      where: { userId },
      include: { Committee: true },
    })

    const headCommittees = committees.filter((c) => c.headUserId === userId)
    const coHeadCommittees = committees.filter((c) => c.coHeadUserId === userId)

    const managedCommittees = [
      ...headCommittees.map((c) => ({
        id: c.id,
        name: c.name,
        role: 'HEAD' as const,
        canCreateDocuments: c.canCreateDocuments,
        canCreateClassified: c.canCreateClassified,
      })),
      ...coHeadCommittees.map((c) => ({
        id: c.id,
        name: c.name,
        role: 'CO_HEAD' as const,
        canCreateDocuments: c.canCreateDocuments,
        canCreateClassified: c.canCreateClassified,
      })),
    ]

    let myRole: 'HEAD' | 'CO_HEAD' | 'MEMBER' | null = null
    let myCommittee: { id: number; name: CommitteeName } | null = null
    let membershipStatus: CommitteeMembershipStatus | null = null

    if (managedCommittees.length > 0) {
      // Prioritize HEAD role for the unified 'my' object, though UI should use managedCommittees
      const primary = managedCommittees[0]
      myRole = primary.role
      myCommittee = { id: primary.id, name: primary.name }
      membershipStatus = CommitteeMembershipStatus.APPROVED
    } else if (membership) {
      myRole = 'MEMBER'
      myCommittee = { id: membership.committeeId, name: membership.Committee.name }
      membershipStatus = membership.status
    }

    // Fetch members for ALL managed committees
    const managedCommitteeIds = managedCommittees.map((c) => c.id)

    let pendingApplicants: Array<{
      membershipId: number
      userId: number
      committeeId: number
      name: string | null
      email: string
      phoneNumber: string
      status: CommitteeMembershipStatus
    }> = []

    let approvedMembers: Array<{
      membershipId: number
      userId: number
      committeeId: number
      name: string | null
      email: string
      phoneNumber: string
      status: CommitteeMembershipStatus
    }> = []

    if (managedCommitteeIds.length > 0) {
      const [pending, approved] = await Promise.all([
        prisma.committeeMembership.findMany({
          where: {
            committeeId: { in: managedCommitteeIds },
            status: CommitteeMembershipStatus.PENDING,
          },
          include: { User: { select: userSummarySelect } },
          orderBy: [{ createdAt: 'asc' }],
        }),
        prisma.committeeMembership.findMany({
          where: {
            committeeId: { in: managedCommitteeIds },
            status: CommitteeMembershipStatus.APPROVED,
          },
          include: { User: { select: userSummarySelect } },
          orderBy: [{ createdAt: 'asc' }],
        }),
      ])

      pendingApplicants = pending.map((m) => ({
        membershipId: m.id,
        userId: m.userId,
        committeeId: m.committeeId,
        name: m.User?.name ?? null,
        email: m.User?.email ?? '',
        phoneNumber: m.User?.phoneNumber ?? '',
        status: m.status,
        photo: m.photo,
      }))

      approvedMembers = approved.map((m) => ({
        membershipId: m.id,
        userId: m.userId,
        committeeId: m.committeeId,
        name: m.User?.name ?? null,
        email: m.User?.email ?? '',
        phoneNumber: m.User?.phoneNumber ?? '',
        status: m.status,
        photo: m.photo,
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
        canCreateDocuments: committee.canCreateDocuments,
        canCreateClassified: committee.canCreateClassified,
        memberCount: committee._count.Members,
      })),
      my: {
        role: myRole,
        committeeId: myCommittee?.id ?? null,
        committeeName: myCommittee?.name ?? null,
        status: membershipStatus,
      },
      managedCommittees,
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

    // Fetch current user name if we need to compare/update
    if (payload.name) {
      const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
      if (currentUser && currentUser.name !== payload.name) {
        await prisma.user.update({
          where: { id: userId },
          data: { name: payload.name },
        })
      }
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
        photo: payload.photo,
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
    const isDocumentation = roles.includes('DOCUMENTATION')

    const headCommittee = await prisma.committee.findFirst({ where: { headUserId: req.user.id } })

    if (!isAdmin && !isDocumentation && !headCommittee) {
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

export async function removeCommitteeMember(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const payload = req.body as RemoveMemberInput

    const membership = await prisma.committeeMembership.findUnique({
      where: { id: payload.membershipId },
      include: { Committee: true },
    })

    if (!membership) {
      return res.status(404).json({ message: 'Membership not found' })
    }

    if (membership.Committee.headUserId !== req.user.id) {
      return res.status(403).json({ message: 'Only the committee head can remove members' })
    }

    await prisma.committeeMembership.delete({
      where: { id: membership.id },
    })


    return res.status(200).json({
      message: 'Member removed',
    })
  } catch (error) {
    return next(error)
  }
}

export async function getCommitteeMembers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const { committeeId } = req.params
    if (!committeeId) {
      return res.status(400).json({ message: 'Committee ID is required' })
    }

    // Check for DOCUMENTATION role
    const roles = await getUserRoles(req.user.id)
    const isDocumentation = roles.includes('DOCUMENTATION')
    const isAdmin = roles.includes('ADMIN')

    if (!isDocumentation && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    const committee = await prisma.committee.findUnique({
      where: { id: Number(committeeId) },
      include: {
        headUser: { select: userSummarySelect },
        coHeadUser: { select: userSummarySelect },
      }
    })

    const members = await prisma.committeeMembership.findMany({
      where: {
        committeeId: Number(committeeId),
        status: CommitteeMembershipStatus.APPROVED,
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
            profileImage: true,
          },
        },
      },
      orderBy: { User: { name: 'asc' } },
    })

    const formattedMembers = members.map((m) => ({
      userId: m.userId,
      name: m.User.name,
      email: m.User.email,
      phoneNumber: m.User.phoneNumber,
      profileImage: m.User.profileImage,
      designation: 'Member',
    }))

    if (committee?.coHeadUser) {
        formattedMembers.unshift({
            userId: committee.coHeadUser.id,
            name: committee.coHeadUser.name,
            email: committee.coHeadUser.email,
            phoneNumber: committee.coHeadUser.phoneNumber,
            profileImage: committee.coHeadUser.profileImage,
            designation: 'Co-Head',
        })
    }

    if (committee?.headUser) {
        formattedMembers.unshift({
            userId: committee.headUser.id,
            name: committee.headUser.name,
            email: committee.headUser.email,
            phoneNumber: committee.headUser.phoneNumber,
            profileImage: committee.headUser.profileImage,
            designation: 'Head',
        })
    }

    return res.status(200).json({ members: formattedMembers })
  } catch (error) {
    return next(error)
  }
}

export async function exportAllCommitteeMembers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })

    const roles = await getUserRoles(req.user.id)
    if (!roles.includes('DOCUMENTATION') && !roles.includes('ADMIN')) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    const committees = await prisma.committee.findMany({
      include: {
        headUser: { select: userSummarySelect },
        coHeadUser: { select: userSummarySelect },
        Members: {
          where: { status: CommitteeMembershipStatus.APPROVED },
          include: { User: { select: userSummarySelect } },
        },
      },
      orderBy: { name: 'asc' },
    })

    const allMembers: any[] = []

    committees.forEach((committee) => {
      if (committee.headUser) {
        allMembers.push({
          committee: committee.name,
          name: committee.headUser.name,
          email: committee.headUser.email,
          phoneNumber: committee.headUser.phoneNumber,
          designation: 'Head',
        })
      }
      if (committee.coHeadUser) {
        allMembers.push({
          committee: committee.name,
          name: committee.coHeadUser.name,
          email: committee.coHeadUser.email,
          phoneNumber: committee.coHeadUser.phoneNumber,
          designation: 'Co-Head',
        })
      }
      committee.Members.forEach((member) => {
        allMembers.push({
          committee: committee.name,
          name: member.User.name,
          email: member.User.email,
          phoneNumber: member.User.phoneNumber,
          designation: 'Member',
        })
      })
    })

    return res.status(200).json({ members: allMembers })
  } catch (error) {
    return next(error)
  }
}

export async function updateCommitteeAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const { committeeId, canCreateDocuments, canCreateClassified } = req.body

    const roles = await getUserRoles(req.user.id)
    const isAdmin = roles.includes('ADMIN')

    const docCommittee = await prisma.committee.findUnique({ where: { name: 'DOCUMENTATION' } })
    const isDocHead = docCommittee?.headUserId === req.user.id

    if (!isAdmin && !isDocHead) {
      return res.status(403).json({ message: 'Forbidden: Only Document Head or Admin can change access' })
    }

    const updated = await prisma.committee.update({
      where: { id: Number(committeeId) },
      data: {
        canCreateDocuments,
        canCreateClassified,
      },
    })

    return res.status(200).json({
      message: 'Access updated',
      committee: updated,
    })
  } catch (error) {
    return next(error)
  }
}
