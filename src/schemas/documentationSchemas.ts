import { z } from 'zod'

export const createDocumentationEventSchema = z
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
        isBranch: z.boolean().optional(),
        branchId: z.number().int().positive().nullable().optional(),
        image: z.string().optional(),
        day: z.array(z.enum(['Day1', 'Day2', 'Day3', 'Day4'])).optional(),
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

export type CreateDocumentationEventInput = z.infer<typeof createDocumentationEventSchema>

export const updateDocumentationEventSchema = z
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
        isBranch: z.boolean().optional(),
        branchId: z.number().int().positive().nullable().optional(),
        image: z.string().optional(),
        day: z.array(z.enum(['Day1', 'Day2', 'Day3', 'Day4'])).optional(),
        published: z.boolean().optional(),
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

export type UpdateDocumentationEventInput = z.infer<typeof updateDocumentationEventSchema>

export const createBranchSchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(100),
})

export type CreateBranchInput = z.infer<typeof createBranchSchema>
