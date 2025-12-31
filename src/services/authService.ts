import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import prisma from '../prisma/client'
import { env } from '../utils/env'
import { AppError } from '../utils/appError'
import type {
  SignupInput,
  ChangePasswordInput,
  ResetPasswordRequestInput,
  ResetPasswordConfirmInput,
} from '../schemas/authSchemas'
import { Category, CollegeType, Gender, Role } from '@prisma/client'
import { sendEmail } from '../utils/mailer'
import type { CommitteeMembershipStatus } from '@prisma/client'
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateToken(userId: number): string {
  const secret: jwt.Secret = env.jwtSecret
  const payload: jwt.JwtPayload = { sub: String(userId) }
  const options: jwt.SignOptions = {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  }

  return jwt.sign(payload, secret, options)
}

async function ensureNmamitCollege() {
  await prisma.college.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'NMAMIT',
      details: 'Default NMAMIT college record',
      type: CollegeType.ENGINEERING,
      championshipPoints: 0,
    },
  })
}

async function ensureHoldingHotel() {
  return prisma.hotel.upsert({
    where: { name: 'UNASSIGNED' },
    update: {},
    create: {
      name: 'UNASSIGNED',
      details: 'Pending accommodation allocation',
      price: 0,
    },
  })
}

function parseDateOrNull(value?: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function generateOtpBundle() {
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
  return {
    otpCode,
    otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
  }
}

async function resolveSelection(payload: SignupInput) {
  let resolvedCollegeId = 1
  let category: Category = Category.INTERNAL

  if (payload.selection === 'NMAMIT') {
    await ensureNmamitCollege()
    return { category, resolvedCollegeId }
  }

  if (payload.selection === 'OTHER') {
    if (!payload.collegeId || payload.collegeId === 1) {
      throw new AppError('Select a valid college', 400)
    }
    const college = await prisma.college.findUnique({ where: { id: payload.collegeId } })
    if (!college) {
      throw new AppError('College not found', 404)
    }
    category = Category.EXTERNAL
    resolvedCollegeId = payload.collegeId
    return { category, resolvedCollegeId }
  }

  if (payload.selection === 'ALUMNI') {
    await ensureNmamitCollege()
    if (!payload.yearOfGraduation || !payload.idDocument) {
      throw new AppError('Alumni details are required', 400)
    }
    category = Category.ALUMNI
    resolvedCollegeId = 1
    return { category, resolvedCollegeId }
  }

  return { category, resolvedCollegeId }
}

export async function createUserWithProfile(payload: SignupInput) {
  const existing = await prisma.user.findUnique({ where: { email: payload.email } })
  if (existing?.isVerified) {
    throw new AppError('Email already in use', 409)
  }

  const { category, resolvedCollegeId } = await resolveSelection(payload)
  const passwordHash = await hashPassword(payload.password)
  const { otpCode, otpExpiresAt } = generateOtpBundle()
  const otpHash = await hashPassword(otpCode)

  const data = {
    name: payload.name,
    email: payload.email,
    password: passwordHash,
    phoneNumber: payload.phoneNumber,
    category,
    isVerified: false,
    collegeId: resolvedCollegeId,
    otpHash,
    otpExpiresAt,
  }

  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data })
    : await prisma.user.create({
        data: {
          ...data,
          UserRoles: { create: [{ role: Role.USER }] },
        },
      })

  if (payload.selection === 'ALUMNI') {
    await prisma.alumni.upsert({
      where: { userId: user.id },
      update: {
        yearOfGraduation: payload.yearOfGraduation!,
        idDocument: payload.idDocument!,
      },
      create: {
        userId: user.id,
        yearOfGraduation: payload.yearOfGraduation!,
        idDocument: payload.idDocument!,
      },
    })
  }

  if (payload.accommodation) {
    const holdingHotel = await ensureHoldingHotel()
    const gender: Gender = payload.accommodation.gender as Gender
    const checkIn = parseDateOrNull(payload.accommodation.checkIn ?? null)
    const checkOut = parseDateOrNull(payload.accommodation.checkOut ?? null)

    await prisma.userInHotel.upsert({
      where: { userId: user.id },
      update: {
        IdCard: payload.accommodation.idProofUrl ?? null,
        gender,
        checkIn,
        checkOut,
        hotelId: holdingHotel.id,
      },
      create: {
        userId: user.id,
        IdCard: payload.accommodation.idProofUrl ?? null,
        gender,
        checkIn,
        checkOut,
        hotelId: holdingHotel.id,
      },
    })
  }

  await sendEmail(
    user.email,
    'Verify your email',
    `Your verification code is ${otpCode}. It expires in 10 minutes.`,
  )

  return prisma.user.findUnique({
    where: { id: user.id },
    include: {
      Alumni: true,
      UserRoles: true,
      BranchRep: true,
      Organizers: true,
    },
  }) as Promise<
    typeof user & {
      Alumni: { yearOfGraduation: number; idDocument: string } | null
      UserRoles: { role: Role }[]
      BranchRep: { id: number } | null
      Organizers: { id: number }[]
    }
  >
}

export async function verifyOtpForUser(email: string, otp: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      password: true,
      phoneNumber: true,
      category: true,
      UserRoles: {
        select: {
          role: true,
        },
      },
      BranchRep: {
        select: { id: true },
      },
      Organizers: {
        select: { id: true },
      },
      collegeId: true,
      isVerified: true,
      otpHash: true,
      otpExpiresAt: true,
      Alumni: {
        select: {
          yearOfGraduation: true,
          idDocument: true,
        },
      },
    },
  })
  if (!user) {
    throw new AppError('User not found', 404)
  }

  if (!user.otpHash || !user.otpExpiresAt) {
    throw new AppError('OTP not requested or expired', 400)
  }

  const otpExpiresAt = user.otpExpiresAt as Date

  if (otpExpiresAt.getTime() < Date.now()) {
    throw new AppError('OTP expired', 400)
  }

  const isValid = await bcrypt.compare(otp, user.otpHash)
  if (!isValid) {
    throw new AppError('Invalid OTP', 400)
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      isVerified: true,
      otpHash: null,
      otpExpiresAt: null,
    },
    include: { Alumni: true, UserRoles: true, BranchRep: true, Organizers: true },
  })

  return updated
}

export async function authenticateUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      password: true,
      phoneNumber: true,
      category: true,
      UserRoles: {
        select: {
          role: true,
        },
      },
      collegeId: true,
      isVerified: true,
      Alumni: {
        select: {
          yearOfGraduation: true,
          idDocument: true,
        },
      },
    },
  })
  if (!user) {
    throw new AppError('Invalid credentials', 401)
  }

  const isValid = await verifyPassword(password, user.password)
  if (!isValid) {
    throw new AppError('Invalid credentials', 401)
  }

  return user
}

export async function getUserById(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { Alumni: true, UserRoles: true, BranchRep: true, Organizers: true },
  })
  if (!user) {
    throw new AppError('User not found', 404)
  }
  return user
}

export async function changePassword(userId: number, payload: ChangePasswordInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new AppError('User not found', 404)
  }

  const matches = await verifyPassword(payload.currentPassword, user.password)
  if (!matches) {
    throw new AppError('Current password is incorrect', 400)
  }

  if (payload.currentPassword === payload.newPassword) {
    throw new AppError('New password must be different', 400)
  }

  const newHash = await hashPassword(payload.newPassword)
  await prisma.user.update({ where: { id: user.id }, data: { password: newHash } })
  return { message: 'Password updated successfully' }
}

export async function requestPasswordReset(payload: ResetPasswordRequestInput) {
  const user = await prisma.user.findUnique({ where: { email: payload.email } })
  if (!user) {
    throw new AppError('User not found', 404)
  }

  const resetToken = jwt.sign({ sub: user.id, purpose: 'password-reset' }, env.jwtSecret, {
    expiresIn: '15m',
  })

  const resetLink = `${env.frontendUrl}/reset-password?token=${encodeURIComponent(resetToken)}`

  await sendEmail(
    user.email,
    'Reset your password',
    `Click the link to reset your password: ${resetLink}
This link expires in 15 minutes. If you did not request this, please ignore the email.`,
  )

  return { message: 'Password reset link sent' }
}

export async function resetPasswordWithToken(payload: ResetPasswordConfirmInput) {
  let decoded: jwt.JwtPayload
  try {
    decoded = jwt.verify(payload.token, env.jwtSecret) as jwt.JwtPayload
  } catch {
    throw new AppError('Invalid or expired reset token', 400)
  }

  if (decoded.purpose !== 'password-reset' || !decoded.sub) {
    throw new AppError('Invalid reset token', 400)
  }

  const userId = typeof decoded.sub === 'string' ? Number(decoded.sub) : decoded.sub
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new AppError('User not found', 404)
  }

  const newHash = await hashPassword(payload.newPassword)
  await prisma.user.update({ where: { id: user.id }, data: { password: newHash } })

  return { message: 'Password reset successfully' }
}

export async function getUserCommitteeSnapshot(userId: number): Promise<{
  committeeRole: 'HEAD' | 'CO_HEAD' | 'MEMBER' | null
  committeeName: string | null
  committeeStatus: CommitteeMembershipStatus | null
}> {
  const headCommittee = await prisma.committee.findFirst({
    where: { headUserId: userId },
    select: { name: true },
  })

  if (headCommittee) {
    return {
      committeeRole: 'HEAD',
      committeeName: headCommittee.name,
      committeeStatus: 'APPROVED',
    }
  }

  const coHeadCommittee = await prisma.committee.findFirst({
    where: { coHeadUserId: userId },
    select: { name: true },
  })

  if (coHeadCommittee) {
    return {
      committeeRole: 'CO_HEAD',
      committeeName: coHeadCommittee.name,
      committeeStatus: 'APPROVED',
    }
  }

  const membership = await prisma.committeeMembership.findUnique({
    where: { userId },
    select: { status: true, Committee: { select: { name: true } } },
  })

  if (membership) {
    return {
      committeeRole: 'MEMBER',
      committeeName: membership.Committee?.name ?? null,
      committeeStatus: membership.status,
    }
  }

  return { committeeRole: null, committeeName: null, committeeStatus: null }
}
