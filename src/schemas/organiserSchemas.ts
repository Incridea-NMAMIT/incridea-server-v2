import { z } from 'zod'

export const createTeamSchema = z.object({
  name: z.string().trim().min(1, 'Team name is required').max(50, 'Team name is too long'),
})

export type CreateTeamInput = z.infer<typeof createTeamSchema>

export const addTeamMemberSchema = z.object({
  userId: z.number().int().positive('User ID is required'),
})

export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>

export const deleteTeamMemberSchema = z.object({
  userId: z.number().int().positive('User ID is required'),
})

export type DeleteTeamMemberInput = z.infer<typeof deleteTeamMemberSchema>

export const markAttendanceSchema = z.object({
  attended: z.boolean(),
})

export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>

export const createQuizSchema = z.object({
  name: z.string().trim().min(1, 'Quiz name is required'),
  description: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  password: z.string().min(1, 'Password is required'),
  overridePassword: z.string().optional(),
})

export type CreateQuizInput = z.infer<typeof createQuizSchema>

export const updateQuizSchema = z.object({
  name: z.string().trim().min(1, 'Quiz name is required'),
  description: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  password: z.string().min(1, 'Password is required'),
  overridePassword: z.string().optional(),
  questions: z.array(
    z.object({
      id: z.string().optional(), 
      question: z.string().min(1, 'Question text is required'),
      description: z.string().optional(),
      isCode: z.boolean().default(false),
      image: z.string().optional(),
      options: z.array(
        z.object({
          id: z.string().optional(),
          value: z.string().min(1, 'Option value is required'),
          isAnswer: z.boolean(),
        })
      ).min(2, 'At least 2 options are required'),
    })
  ),
})


export type UpdateQuizInput = z.infer<typeof updateQuizSchema>

export const updateOrganiserProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(100, 'Name is too long'),
  phoneNumber: z.string().regex(/^(\+91 )?\d{10}$/, 'Phone number must be 10 digits (optionally starting with +91)'),
})

export type UpdateOrganiserProfileInput = z.infer<typeof updateOrganiserProfileSchema>
