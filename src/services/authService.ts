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

// async function ensureHoldingHotel() {
//   return prisma.hotel.upsert({
//     where: { name: 'UNASSIGNED' },
//     update: {},
//     create: {
//       name: 'UNASSIGNED',
//       details: 'Pending accommodation allocation',
//       price: 0,
//     },
//   })
// }

// function parseDateOrNull(value?: string | null) {
//   if (!value) return null
//   const parsed = new Date(value)
//   return Number.isNaN(parsed.getTime()) ? null : parsed
// }

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
  const email = payload.email.toLowerCase()
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    throw new AppError('Email already in use', 409)
  }

  const { category, resolvedCollegeId } = await resolveSelection(payload)
  const passwordHash = await hashPassword(payload.password)
  const { otpCode, otpExpiresAt } = generateOtpBundle()
  const otpHash = await hashPassword(otpCode)

  const data = {
    name: payload.name,
    email,
    password: passwordHash,
    phoneNumber: payload.phoneNumber,
    gender: payload.gender as Gender,
    category,
    isVerified: false,
    collegeId: resolvedCollegeId,
    otpHash,
    otpExpiresAt,
  }

  const user = await prisma.user.create({
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
    // const holdingHotel = await ensureHoldingHotel()
    // const gender: Gender = payload.gender as Gender
    // const checkIn = parseDateOrNull(payload.accommodation.checkIn ?? null)
    // const checkOut = parseDateOrNull(payload.accommodation.checkOut ?? null)

    // await prisma.userInHotel.upsert({
    //   where: { userId: user.id },
    //   update: {
    //     IdCard: payload.accommodation.idProofUrl ?? null,
    //     gender,
    //     checkIn,
    //     checkOut,
    //     hotelId: holdingHotel.id,
    //   },
    //   create: {
    //     userId: user.id,
    //     IdCard: payload.accommodation.idProofUrl ?? null,
    //     gender,
    //     checkIn,
    //     checkOut,
    //     hotelId: holdingHotel.id,
    //   },
    // })
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
      Organisers: true,
      Judges: true,
      PID: true,
    },
  }) as Promise<
    typeof user & {
      Alumni: { yearOfGraduation: number; idDocument: string } | null
      UserRoles: { role: Role }[]
      BranchRep: { id: number } | null
      Organisers: { id: number }[]
      Judges: { id: number }[]
      PID: { pidCode: string } | null
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
      Organisers: {
        select: { id: true },
      },
      Judges: {
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
      PID: {
        select: {
          pidCode: true
        }
      }
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
    include: { Alumni: true, UserRoles: true, BranchRep: true, Organisers: true, Judges: true, PID: true },
  })

  return updated
}

export async function resendOtpForUser(email: string) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    throw new AppError('User not found', 404)
  }
  if (user.isVerified) {
    throw new AppError('User already verified', 400)
  }

  const { otpCode, otpExpiresAt } = generateOtpBundle()
  const otpHash = await hashPassword(otpCode)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      otpHash,
      otpExpiresAt,
    },
  })

  await sendEmail(
    user.email,
    'Verify your email',
    `Your verification code is ${otpCode}. It expires in 10 minutes.`,
  )

  return { message: 'OTP resent successfully' }
}

export async function authenticateUser(email: string, password: string) {
  email = email.toLowerCase()
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
      createdAt: true,
      BranchRep: {
        select: {
          id: true,
        },
      },
      Organisers: {
        select: {
          id: true,
        },
      },
      Judges: {
        select: {
          id: true,
        },
      },
      PID: {
        select: {
          pidCode: true
        }
      }
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
    include: { Alumni: true, UserRoles: true, BranchRep: true, Organisers: true, Judges: true, PID: true },
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

  // Create a verification token record
  const verificationToken = await prisma.verificationToken.create({
    data: {
      userId: user.id,
      type: 'RESET_PASSWORD',
    },
  })

  // Sign the token ID into the JWT. 
  // We set JWT expiry to slightly longer than the business logic expiry (30m) to be safe, e.g., 40m.
  const resetToken = jwt.sign(
    { sub: verificationToken.id, purpose: 'password-reset' },
    env.jwtSecret,
    { expiresIn: '40m' }
  )

  const resetLink = `${env.frontendUrl}/reset-password?token=${encodeURIComponent(resetToken)}`

  await sendEmail(
    user.email,
    'Reset your password',
    `Click the link to reset your password: ${resetLink}
This link expires in 30 minutes. If you did not request this, please ignore the email.`,
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

  const tokenId = decoded.sub as string // The JWT sub is now the VerificationToken ID

  const dbToken = await prisma.verificationToken.findUnique({
    where: { id: tokenId },
    include: { User: true },
  })

  if (!dbToken) {
    throw new AppError('Invalid reset token', 400)
  }

  if (dbToken.revoked) {
    throw new AppError('This reset link has already been used', 400)
  }

  // Check 30-minute expiry
  const now = new Date()
  const tokenAge = now.getTime() - dbToken.createdAt.getTime()
  const thirtyMinutes = 30 * 60 * 1000

  if (tokenAge > thirtyMinutes) {
    throw new AppError('Reset link has expired', 400)
  }

  const user = dbToken.User
  const newHash = await hashPassword(payload.newPassword)
  
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { password: newHash } }),
    prisma.verificationToken.update({ where: { id: tokenId }, data: { revoked: true } }),
  ])

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
