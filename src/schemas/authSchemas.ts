import { z } from 'zod'

export const collegeSelection = z.enum(['NMAMIT', 'OTHER', 'ALUMNI'])

export const signupSchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Confirm your password'),
    phoneNumber: z.string().min(7, 'Phone number is required'),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
    selection: collegeSelection,
    collegeId: z.number().int().positive().optional(),
    yearOfGraduation: z.number().int().min(1950).max(new Date().getFullYear() + 10).optional(),
    idDocument: z.string().min(1).optional(),
    accommodation: z
      .object({
        gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
        checkIn: z.string().optional(),
        checkOut: z.string().optional(),
        idProofUrl: z.string().url('Provide a valid uploaded ID proof'),
      })
      .optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords must match',
    path: ['confirmPassword'],
  })
  .superRefine((data, ctx) => {
    if (data.selection === 'OTHER') {
      if (!data.collegeId || data.collegeId === 1) {
        ctx.addIssue({
          code: 'custom',
          message: 'Select a college other than NMAMIT',
          path: ['collegeId'],
        })
      }
    }

    if (data.selection === 'ALUMNI') {
      if (!data.yearOfGraduation) {
        ctx.addIssue({
          code: 'custom',
          message: 'Year of graduation is required for alumni',
          path: ['yearOfGraduation'],
        })
      }
      if (!data.idDocument) {
        ctx.addIssue({
          code: 'custom',
          message: 'ID document link is required for alumni',
          path: ['idDocument'],
        })
      }
    }
  })

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
})

export const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(4, 'Enter the OTP sent to your email'),
})

export const resetPasswordRequestSchema = z.object({
  email: z.string().email(),
})

export const resetPasswordConfirmSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmNewPassword: z.string().min(8, 'Confirm the new password'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'New passwords must match',
    path: ['confirmNewPassword'],
  })

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(8, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmNewPassword: z.string().min(8, 'Confirm the new password'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'New passwords must match',
    path: ['confirmNewPassword'],
  })

export type SignupInput = z.infer<typeof signupSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type ResetPasswordRequestInput = z.infer<typeof resetPasswordRequestSchema>
export type ResetPasswordConfirmInput = z.infer<typeof resetPasswordConfirmSchema>
export type AccommodationInput = NonNullable<SignupInput['accommodation']>
