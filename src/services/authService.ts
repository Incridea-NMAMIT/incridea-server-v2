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
import { getUtilityEmailHtml } from '../templates/utilityEmail'
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

export function generateTokenWithSession(userId: number, sessionId: string): string {
    const secret: jwt.Secret = env.jwtSecret
    const payload: jwt.JwtPayload = { sub: String(userId), sessionId }
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
      type: CollegeType.ENGINEERING,
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

  if (payload.verificationToken) {
    // Verify the token
    try {
        const decoded = jwt.verify(payload.verificationToken, env.jwtSecret) as jwt.JwtPayload
        if (decoded.purpose !== 'google-verification' || decoded.email !== email) {
            throw new AppError('Invalid verification token', 400)
        }
        // Skip OTP
        data.isVerified = true
    } catch (e) {
        throw new AppError('Invalid or expired verification token', 400)
    }
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
    // Accommodation logic commented out in original
  }

  if (!data.isVerified) {
      const emailHtml = getUtilityEmailHtml(`
        <div style="text-align: center;">
          <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 16px;">Welcome to Incridea! </h1>
          <p style="color: #cbd5e1; margin-bottom: 24px; font-size: 16px;">
            We're super excited to have you on board! To get started, please verify your email address.
          </p>
          <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 24px; display: inline-block; margin: 16px 0;">
            <p style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;">Verification Code</p>
            <span style="font-family: 'Courier New', monospace; font-size: 32px; letter-spacing: 4px; font-weight: bold; color: #ffffff;">${otpCode}</span>
          </div>
          <p style="color: #64748b; font-size: 13px; margin-top: 24px;">
            This code expires in 10 minutes.
          </p>
        </div>
      `)
    
      await sendEmail(
        user.email,
        'Verify your email ',
        `Your verification code is ${otpCode}. It expires in 10 minutes.`,
        emailHtml,
      )
  }

  return prisma.user.findUnique({
    where: { id: user.id },
    include: {
      Alumni: true,
      UserRoles: true,
      BranchRep: true,
      Organisers: true,
      Judges: true,
      PID: true,
      HeadOfCommittee: true,
    },
  }) as Promise<
    typeof user & {
      Alumni: { yearOfGraduation: number; idDocument: string } | null
      UserRoles: { role: Role }[]
      BranchRep: { id: number } | null
      Organisers: { id: number }[]
      Judges: { id: number }[]
      PID: { pidCode: string } | null
      HeadOfCommittee: any[]
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
      },
      HeadOfCommittee: {
        select: {
          id: true,
          name: true
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
    include: { Alumni: true, UserRoles: true, BranchRep: true, Organisers: true, Judges: true, PID: true, HeadOfCommittee: true },
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

  const emailHtml = getUtilityEmailHtml(`
    <div style="text-align: center;">
      <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 16px;">New Verification Code </h1>
      <p style="color: #cbd5e1; margin-bottom: 24px; font-size: 16px;">
        Did the last one get lost in the dimensions? No worries! Here's a fresh code just for you.
      </p>
      <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 24px; display: inline-block; margin: 16px 0;">
        <p style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;">Verification Code</p>
        <span style="font-family: 'Courier New', monospace; font-size: 32px; letter-spacing: 4px; font-weight: bold; color: #ffffff;">${otpCode}</span>
      </div>
      <p style="color: #64748b; font-size: 13px; margin-top: 24px;">
        This code expires in 10 minutes.
      </p>
    </div>
  `)

  await sendEmail(
    user.email,
    'Verify your email ',
    `Your verification code is ${otpCode}. It expires in 10 minutes.`,
    emailHtml,
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
      },
      HeadOfCommittee: {
        select: {
          id: true,
          name: true
        }
      }
    },
  })
  if (!user) {
    throw new AppError('User not found', 404)
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
    include: { Alumni: true, UserRoles: true, BranchRep: true, Organisers: true, Judges: true, PID: true, HeadOfCommittee: true },
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

  const emailHtml = getUtilityEmailHtml(`
    <div style="text-align: center;">
      <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 16px;">Reset Your Password </h1>
      <p style="color: #cbd5e1; margin-bottom: 24px; font-size: 16px;">
        Trouble signing in? No problem! Click the button below to reset your password.
      </p>
      <div style="margin: 32px 0;">
        <a href="${resetLink}" style="background: linear-gradient(135deg, #2563eb, #7c3aed); color: #ffffff; font-weight: 600; padding: 14px 32px; border-radius: 9999px; text-decoration: none; display: inline-block; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);">Reset Password</a>
      </div>
      <p style="color: #64748b; font-size: 13px; margin-top: 24px;">
        This link is valid for 30 minutes.<br>If you didn't request a password reset, you can safely ignore this email.
      </p>
    </div>
  `)

  await sendEmail(
    user.email,
    'Reset your password ',
    `Click the link to reset your password: ${resetLink}`,
    emailHtml,
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

// Google Auth Helpers
function validateGoogleParams() {
  if (!env.google.clientId || !env.google.clientSecret || !env.google.redirectUri) {
      throw new AppError('Google Auth not configured', 500)
  }
  return {
      clientId: env.google.clientId,
      clientSecret: env.google.clientSecret,
      redirectUri: env.google.redirectUri
  }
}

export function getGoogleUrl(email?: string) {
    const { clientId, redirectUri } = validateGoogleParams()
    const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
    const options: Record<string, string> = {
        redirect_uri: redirectUri,
        client_id: clientId,
        access_type: 'offline',
        response_type: 'code',
        prompt: 'consent',
        scope: [
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email',
        ].join(' '),
    }

    if (email) {
        options.login_hint = email
    }

    const qs = new URLSearchParams(options)
    return `${rootUrl}?${qs.toString()}`
}

async function getGoogleTokens(code: string) {
    const { clientId, clientSecret, redirectUri } = validateGoogleParams()
    const url = 'https://oauth2.googleapis.com/token'
    const values = {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
    }

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(values).toString()
        })
        
        if (!res.ok) {
             const error = await res.text()
             console.error('Google Token Error:', error)
        }
        
        const data = await res.json() as { access_token: string; id_token: string }
        return data
    } catch (error) {
        console.error('Google Token Exchange Failed:', error)
        throw new AppError('Google Token Exchange', 400)
    }
}

async function getGoogleUser(id_token: string, access_token: string) {
    try {
        const res = await fetch(`https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${access_token}`, {
            headers: {
                Authorization: `Bearer ${id_token}`,
            },
        })
        if (!res.ok) {
            throw new Error('Failed to fetch Google user')
        }
        const data = await res.json() as { id: string; email: string; verified_email: boolean; name: string; picture: string }
        return data
    } catch (error) {
        throw new AppError('Failed to fetch Google profile', 400)
    }
}

export async function verifyGoogleLogin(code: string) {
    const { id_token, access_token } = await getGoogleTokens(code)
    const googleUser = await getGoogleUser(id_token, access_token)

    if (!googleUser.verified_email) {
        throw new AppError('Google email not verified', 400)
    }

    const user = await prisma.user.findUnique({
        where: { email: googleUser.email.toLowerCase() },
        include: {
            Alumni: true,
            UserRoles: true,
            BranchRep: true,
            Organisers: true,
            Judges: true,
            PID: true,
            HeadOfCommittee: true,
        },
    })

    if (!user) {
        // User not found, return info to redirect to registration
        // But the requirement says "prefil the email id in the login page of the google" - ambiguous.
        // Actually, if login fails, we ideally want to tell the frontend "Email not found, please register"
        // But for "Sign in with Google", if they don't exist, we can't login.
        // Let's throw a specific error or return a status? 
        // For now, standard behavior: throw 404 or specific message.
        throw new AppError('User not found. Please register first.', 404)
    }

    return user
}

export async function verifyGoogleRegistration(code: string) {
    const { id_token, access_token } = await getGoogleTokens(code)
    const googleUser = await getGoogleUser(id_token, access_token)

    if (!googleUser.verified_email) {
        throw new AppError('Google email not verified', 400)
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({
        where: { email: googleUser.email.toLowerCase() },
    })

    if (existing) {
         throw new AppError('User already exists. Please login.', 409)
    }

    // Sign a verification token
    const verificationToken = jwt.sign(
        { email: googleUser.email.toLowerCase(), purpose: 'google-verification' },
        env.jwtSecret,
        { expiresIn: '1h' }
    )

    return {
        email: googleUser.email.toLowerCase(),
        name: googleUser.name,
        verificationToken
    }
}

export async function checkEmail(email: string) {
    const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: { id: true, isVerified: true }
    })
    return { 
        exists: !!user,
        verified: !!user?.isVerified
    }
}
