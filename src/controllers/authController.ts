import type { Request, Response, NextFunction } from 'express'
import {
  authenticateUser,
  createUserWithProfile,
  generateToken,
  verifyOtpForUser,
  getUserById,
  changePassword,
  requestPasswordReset,
  resetPasswordWithToken,
  getUserCommitteeSnapshot,
} from '../services/authService'
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
    return res.status(201).json({
      message: 'User saved. Please verify your email with the OTP sent.',
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
    if (!user.isVerified) {
      return res.status(403).json({ message: 'Please verify your email to continue.' })
    }
    const token = generateToken(user.id)

    const committee = await getUserCommitteeSnapshot(user.id)

    void logWebEvent({
      message: `Login success for ${user.email}`,
      userId: user.id,
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
    const token = generateToken(user.id)
    const committee = await getUserCommitteeSnapshot(user.id)

    void logWebEvent({
      message: `OTP verified for ${email}`,
      userId: user.id,
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
      },
    })
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
