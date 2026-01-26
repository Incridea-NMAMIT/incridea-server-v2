import type { Request, Response, NextFunction } from 'express'
import {
  authenticateUser,
  createUserWithProfile,
  verifyOtpForUser,
  resendOtpForUser,
  getUserById,
  changePassword,
  requestPasswordReset,
  resetPasswordWithToken,
  getUserCommitteeSnapshot,
  getGoogleUrl,
  verifyGoogleLogin,
  verifyGoogleRegistration,
  checkEmail,
  generateTokenWithSession,
} from '../services/authService'
import { razorpay } from '../services/razorpay'
import { getIO } from '../socket'
import jwt from 'jsonwebtoken'
import { env } from '../utils/env'
import { PaymentType, Status } from '@prisma/client'
import prisma from '../prisma/client'
import type { AuthenticatedRequest } from '../middlewares/authMiddleware'
import type {
  ChangePasswordInput,
  LoginInput,
  SignupInput,
  VerifyOtpInput,
  ResetPasswordRequestInput,
  ResetPasswordConfirmInput,
} from '../schemas/authSchemas'
import { logWebEvent } from '../services/logService'

export async function signup(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await createUserWithProfile(req.body as SignupInput)
    const committee = await getUserCommitteeSnapshot(user.id)
    void logWebEvent({
      message: `Signup success for ${user.email}`,
      userId: user.id,
    })

    // Create Razorpay Order
    let paymentOrderDetails = null
    try {
        const paymentOrder = await razorpay.orders.create({
            amount: 250 * 100, // 250 INR in paise
            currency: 'INR',
            receipt: `receipt_${user.id}`,
            notes: { userId: user.id },
        })

        await prisma.paymentOrder.create({
            data: {
                orderId: paymentOrder.id,
                amount: 250,
                status: Status.PENDING,
                type: PaymentType.FEST_REGISTRATION,
                userId: user.id,
            }
        })
        
        paymentOrderDetails = {
            id: paymentOrder.id,
            amount: paymentOrder.amount,
            currency: paymentOrder.currency,
            keyId: process.env.RAZORPAY_KEY_ID
        }
    } catch (err) {
        console.error("Razorpay order creation failed", err)
        // Proceed without payment order or handle error? 
        // For now, let's log and proceed, but user might need to retry payment later.
        // Ideally should revert user creation or return error, but user creation is successful.
    }

    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    const session = await prisma.session.create({
        data: {
            userId: user.id,
            expiresAt: expiresAt,
            userAgent: req.headers['user-agent'] || 'unknown',
            ip: req.ip || 'unknown'
        }
    })

    const token = generateTokenWithSession(user.id, session.id)

    const isProduction = process.env.NODE_ENV === 'production'
    const domain = process.env.COOKIE_DOMAIN || (isProduction ? '.incridea.in' : undefined) // undefined for localhost to let browser handle it

    res.cookie('token', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'lax' : 'lax', // Lax is good for navigation
        domain: domain,
        path: '/',
        maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
    })

    return res.status(201).json({
      message: 'User saved. Please verify your email with the OTP sent.',
      token,
      paymentOrder: paymentOrderDetails,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        category: user.category,
        collegeId: user.collegeId,
        roles: user.UserRoles?.map((r) => r.role) ?? [],
        isBranchRep: Boolean(user.BranchRep),
        isOrganiser: Array.isArray(user.Organisers) && user.Organisers.length > 0,
        isJudge: Array.isArray(user.Judges) && user.Judges.length > 0,
        isVerified: user.isVerified,
        phoneNumber: user.phoneNumber,
        yearOfGraduation: user.Alumni?.yearOfGraduation ?? null,
        alumniIdDocument: user.Alumni?.idDocument ?? null,
        committeeRole: committee.committeeRole,
        committeeName: committee.committeeName,
        committeeStatus: committee.committeeStatus,
        createdAt: user.createdAt,
        pid: user.PID?.pidCode || null,
        HeadOfCommittee: user.HeadOfCommittee || [],
      },
    })
  } catch (error) {
    return next(error)
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body as LoginInput
    const user = await authenticateUser(email, password)
    // Removed verification check to allow unverified login (frontend handles redirect)
    
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    const session = await prisma.session.create({
        data: {
            userId: user.id,
            expiresAt: expiresAt,
            userAgent: req.headers['user-agent'] || 'unknown',
            ip: req.ip || 'unknown'
        }
    })

    const token = generateTokenWithSession(user.id, session.id)

    const committee = await getUserCommitteeSnapshot(user.id)

    void logWebEvent({
      message: `Login success for ${user.email}`,
      userId: user.id,
    })

    const io = getIO()
    io.emit('auth:login', { userId: user.id })

    const isProduction = process.env.NODE_ENV === 'production'
    const domain = process.env.COOKIE_DOMAIN || (isProduction ? '.incridea.in' : undefined)

    res.cookie('token', token, {
       httpOnly: true,
       secure: isProduction,
       sameSite: 'lax', 
       domain: domain,
       path: '/',
       maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
    })

    return res.status(200).json({
      message: 'Logged in',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        category: user.category,
        collegeId: user.collegeId,
        roles: user.UserRoles?.map((r) => r.role) ?? [],
        isBranchRep: Boolean(user.BranchRep),
        isOrganiser: Array.isArray(user.Organisers) && user.Organisers.length > 0,
        isJudge: Array.isArray(user.Judges) && user.Judges.length > 0,
        isVerified: user.isVerified,
        phoneNumber: user.phoneNumber,
        yearOfGraduation: user.Alumni?.yearOfGraduation ?? null,
        alumniIdDocument: user.Alumni?.idDocument ?? null,
        committeeRole: committee.committeeRole,
        committeeName: committee.committeeName,
        committeeStatus: committee.committeeStatus,
        createdAt: user.createdAt,
        pid: user.PID?.pidCode || null,
        HeadOfCommittee: user.HeadOfCommittee || [],
      },
    })
  } catch (error) {
    return next(error)
  }
}

export async function verifyOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, otp } = req.body as VerifyOtpInput
    const user = await verifyOtpForUser(email, otp)
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    const session = await prisma.session.create({
        data: {
            userId: user.id,
            expiresAt: expiresAt,
            userAgent: req.headers['user-agent'] || 'unknown',
            ip: req.ip || 'unknown'
        }
    })

    const token = generateTokenWithSession(user.id, session.id)
    const committee = await getUserCommitteeSnapshot(user.id)

    void logWebEvent({
      message: `OTP verified for ${email}`,
      userId: user.id,
    })

    const io = getIO()
    io.emit('auth:login', { userId: user.id })

    const isProduction = process.env.NODE_ENV === 'production'
    const domain = process.env.COOKIE_DOMAIN || (isProduction ? '.incridea.in' : undefined)

    res.cookie('token', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        domain: domain,
        path: '/',
        maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
    })

    return res.status(200).json({
      message: 'Email verified successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        category: user.category,
        collegeId: user.collegeId,
        roles: user.UserRoles?.map((r) => r.role) ?? [],
        isBranchRep: Boolean(user.BranchRep),
        isOrganiser: Array.isArray(user.Organisers) && user.Organisers.length > 0,
        isJudge: Array.isArray(user.Judges) && user.Judges.length > 0,
        isVerified: user.isVerified,
        phoneNumber: user.phoneNumber,
        yearOfGraduation: user.Alumni?.yearOfGraduation ?? null,
        alumniIdDocument: user.Alumni?.idDocument ?? null,
        committeeRole: committee.committeeRole,
        committeeName: committee.committeeName,
        committeeStatus: committee.committeeStatus,
        createdAt: user.createdAt,
        pid: user.PID?.pidCode || null,
        HeadOfCommittee: user.HeadOfCommittee || [],
      },
    })
  } catch (error) {
    return next(error)
  }
}

export async function resendOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = req.body
    await resendOtpForUser(email)
    void logWebEvent({
      message: `OTP resent for ${email}`,
    })
    return res.status(200).json({ message: 'OTP resent successfully' })
  } catch (error) {
    return next(error)
  }
}

export async function me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' })
    }
    const user = await getUserById(req.user.id)
    const committee = await getUserCommitteeSnapshot(user.id)
    return res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        category: user.category,
        collegeId: user.collegeId,
        roles: user.UserRoles?.map((r) => r.role) ?? [],
        isBranchRep: Boolean(user.BranchRep),
        isOrganiser: Array.isArray(user.Organisers) && user.Organisers.length > 0,
        isJudge: Array.isArray(user.Judges) && user.Judges.length > 0,
        isVerified: user.isVerified,
        phoneNumber: user.phoneNumber,
        yearOfGraduation: user.Alumni?.yearOfGraduation ?? null,
        alumniIdDocument: user.Alumni?.idDocument ?? null,
        committeeRole: committee.committeeRole,
        committeeName: committee.committeeName,
        committeeStatus: committee.committeeStatus,
        createdAt: user.createdAt,
        pid: user.PID?.pidCode || null,
        HeadOfCommittee: user.HeadOfCommittee || [],
      },
    })
  } catch (error) {
    return next(error)
  }
}

export async function changePasswordHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' })
    }
    const payload = req.body as ChangePasswordInput
    const result = await changePassword(req.user.id, payload)
    void logWebEvent({
      message: 'Password changed',
      userId: req.user.id,
    })
    return res.status(200).json(result)
  } catch (error) {
    return next(error)
  }
}

export async function requestPasswordResetHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = req.body as ResetPasswordRequestInput
    const result = await requestPasswordReset(payload)
    void logWebEvent({
      message: `Password reset requested for ${payload.email}`,
    })
    return res.status(200).json(result)
  } catch (error) {
    return next(error)
  }
}

export async function resetPasswordHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = req.body as ResetPasswordConfirmInput
    const result = await resetPasswordWithToken(payload)
    void logWebEvent({
      message: 'Password reset via token',
    })
    return res.status(200).json(result)
  } catch (error) {
    return next(error)
  }
}

export async function verifyMasterKey(req: Request, res: Response, next: NextFunction) {
  try {
    const { key } = req.body
    if (!process.env.MASTER_KEY) {
      console.warn('MASTER_KEY is not set in environment variables')
      return res.status(500).json({ message: 'Server configuration error' })
    }
    
    if (key === process.env.MASTER_KEY) {
      return res.status(200).json({ success: true, message: 'Master key verified' })
    } else {
      return res.status(401).json({ success: false, message: 'Invalid master key' })
    }
  } catch (error) {
    return next(error)
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const io = getIO()
    
    // Attempt to extract userId from token to emit meaningful logout event
    const token = req.cookies?.token
    if (token) {
        try {
            const decoded = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload & { sessionId?: string }
            const userId = decoded.sub ? parseInt(decoded.sub as string, 10) : null
            if (userId) {
                io.emit('auth:logout', { userId })
            }
            if (decoded.sessionId) {
                await prisma.session.delete({ where: { id: decoded.sessionId } }).catch(err => {
                    console.error("Failed to delete session on logout", err)
                })
            }
        } catch (err) {
            console.error('Logout: Failed to verify token for event emission', err)
            // Continue to clear cookie regardless
        }
    }

    const isProduction = process.env.NODE_ENV === 'production'
    const domain = process.env.COOKIE_DOMAIN || (isProduction ? '.incridea.in' : undefined)

    res.clearCookie('token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      domain: domain,
      path: '/'
    })
    return res.status(200).json({ message: 'Logged out successfully' })
  } catch (error) {
    return next(error)
  }
}

export async function getGoogleUrlHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const email = req.query.email as string | undefined
        const url = getGoogleUrl(email)
        return res.status(200).json({ url })
    } catch (error) {
        return next(error)
    }
}

export async function verifyGoogleRegistrationHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { code } = req.body
        const result = await verifyGoogleRegistration(code)
        return res.status(200).json(result)
    } catch (error) {
       return next(error)
    }
}

export async function googleLoginHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { code } = req.body
        const user = await verifyGoogleLogin(code)
        const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        const session = await prisma.session.create({
            data: {
                userId: user.id,
                expiresAt: expiresAt,
                userAgent: req.headers['user-agent'] || 'unknown',
                ip: req.ip || 'unknown'
            }
        })
        const token = generateTokenWithSession(user.id, session.id)
        const committee = await getUserCommitteeSnapshot(user.id)
        
        void logWebEvent({
             message: `Google Login success for ${user.email}`,
             userId: user.id
        })

        const io = getIO()
        io.emit('auth:login', { userId: user.id })

        const isProduction = process.env.NODE_ENV === 'production'
        const domain = process.env.COOKIE_DOMAIN || (isProduction ? '.incridea.in' : undefined)

        res.cookie('token', token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            domain: domain,
            path: '/',
            maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
        })

       return res.status(200).json({
          message: 'Logged in',
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            category: user.category,
            collegeId: user.collegeId,
            roles: user.UserRoles?.map((r) => r.role) ?? [],
            isBranchRep: Boolean(user.BranchRep),
            isOrganiser: Array.isArray(user.Organisers) && user.Organisers.length > 0,
            isJudge: Array.isArray(user.Judges) && user.Judges.length > 0,
            isVerified: user.isVerified,
            phoneNumber: user.phoneNumber,
            yearOfGraduation: user.Alumni?.yearOfGraduation ?? null,
            alumniIdDocument: user.Alumni?.idDocument ?? null,
            committeeRole: committee.committeeRole,
            committeeName: committee.committeeName,
            committeeStatus: committee.committeeStatus,
            createdAt: user.createdAt,
            pid: user.PID?.pidCode || null,
            HeadOfCommittee: user.HeadOfCommittee || [],
          },
        })
    } catch (error) {
        return next(error)
    }
}

export async function checkEmailHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { email } = req.body
        const result = await checkEmail(email)
        return res.status(200).json(result)
    } catch (error) {
        return next(error)
    }
}
