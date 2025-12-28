import { z } from 'zod'

export const updateSettingSchema = z.object({
  value: z.boolean(),
})

export const upsertVariableSchema = z.object({
  value: z.string().min(1),
})

export type UpdateSettingInput = z.infer<typeof updateSettingSchema>
export type UpsertVariableInput = z.infer<typeof upsertVariableSchema>
