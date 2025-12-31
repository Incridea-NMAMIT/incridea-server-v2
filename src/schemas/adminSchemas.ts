import { Role } from '@prisma/client'
import { z } from 'zod'

export const updateSettingSchema = z.object({
  value: z.boolean(),
})

export const upsertVariableSchema = z.object({
  value: z.string().min(1),
})

export const updateUserRolesSchema = z.object({
  roles: z.array(z.nativeEnum(Role)).min(1, 'At least one role is required'),
})

export type UpdateSettingInput = z.infer<typeof updateSettingSchema>
export type UpsertVariableInput = z.infer<typeof upsertVariableSchema>
export type UpdateUserRolesInput = z.infer<typeof updateUserRolesSchema>
