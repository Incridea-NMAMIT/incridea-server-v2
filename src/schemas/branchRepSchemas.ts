import { z } from 'zod'

export const createBranchEventSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long'),
    description: z.string().trim().max(5000, 'Description is too long').optional(),
    venue: z.string().trim().max(255, 'Venue is too long').optional(),
    fees: z.number().int().nonnegative().optional(),
    minTeamSize: z.number().int().positive().optional(),
    maxTeamSize: z.number().int().positive().optional(),
    maxTeams: z.number().int().positive().nullable().optional(),
    eventType: z.enum(['INDIVIDUAL', 'TEAM', 'INDIVIDUAL_MULTIPLE_ENTRY', 'TEAM_MULTIPLE_ENTRY']),
    category: z.enum(['TECHNICAL', 'NON_TECHNICAL', 'CORE', 'SPECIAL']).optional(),
    tier: z.enum(['DIAMOND', 'GOLD', 'SILVER', 'BRONZE']).optional(),
  })
  .refine(
    (data) => {
      if (data.minTeamSize !== undefined && data.maxTeamSize !== undefined) {
        return data.maxTeamSize >= data.minTeamSize
      }
      return true
    },
    { message: 'maxTeamSize must be greater than or equal to minTeamSize' },
  )

export type CreateBranchEventInput = z.infer<typeof createBranchEventSchema>

export const addOrganizerSchema = z.object({
  email: z.string().trim().email('A valid organizer email is required'),
})

export type AddOrganizerInput = z.infer<typeof addOrganizerSchema>

export const updateBranchEventSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long').optional(),
    description: z.string().trim().max(5000, 'Description is too long').optional(),
    venue: z.string().trim().max(255, 'Venue is too long').optional(),
    fees: z.number().int().nonnegative().optional(),
    minTeamSize: z.number().int().positive().optional(),
    maxTeamSize: z.number().int().positive().optional(),
    maxTeams: z.number().int().positive().nullable().optional(),
    eventType: z.enum(['INDIVIDUAL', 'TEAM', 'INDIVIDUAL_MULTIPLE_ENTRY', 'TEAM_MULTIPLE_ENTRY']).optional(),
    category: z.enum(['TECHNICAL', 'NON_TECHNICAL', 'CORE', 'SPECIAL']).optional(),
    tier: z.enum(['DIAMOND', 'GOLD', 'SILVER', 'BRONZE']).optional(),
  })
  .refine(
    (data) => {
      if (data.minTeamSize !== undefined && data.maxTeamSize !== undefined) {
        return data.maxTeamSize >= data.minTeamSize
      }
      return true
    },
    { message: 'maxTeamSize must be greater than or equal to minTeamSize' },
  )

export type UpdateBranchEventInput = z.infer<typeof updateBranchEventSchema>

export const publishBranchEventSchema = z.object({
  publish: z.boolean(),
})

export type PublishBranchEventInput = z.infer<typeof publishBranchEventSchema>
