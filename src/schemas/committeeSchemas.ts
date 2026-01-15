import { z } from 'zod'

const COMMITTEE_VALUES = [
  'MEDIA',
  'SOCIAL_MEDIA',
  'THORANA',
  'EVENT_MANAGEMENT',
  'ACCOMMODATION',
  'DIGITAL',
  'INAUGURAL',
  'CREW',
  'HOUSE_KEEPING',
  'FOOD',
  'TRANSPORT',
  'PUBLICITY',
  'DOCUMENTATION',
  'FINANCE',
  'CULTURAL',
  'REQUIREMENTS',
  'DISCIPLINARY',
  'TECHNICAL',
  'JURY',
] as const

export const applyCommitteeSchema = z.object({
  committee: z.enum(COMMITTEE_VALUES),
  name: z.string().trim().min(3).optional(),
})

export const assignHeadSchema = z.object({
  committee: z.enum(COMMITTEE_VALUES),
  email: z.string().trim().email('A valid email is required'),
})

export const assignCoHeadSchema = z.object({
  committee: z.enum(COMMITTEE_VALUES),
  email: z.string().trim().email('A valid email is required'),
})

export const approveMemberSchema = z.object({
  membershipId: z.number().int().positive(),
})

export type ApplyCommitteeInput = z.infer<typeof applyCommitteeSchema>
export type AssignHeadInput = z.infer<typeof assignHeadSchema>
export type AssignCoHeadInput = z.infer<typeof assignCoHeadSchema>
export type ApproveMemberInput = z.infer<typeof approveMemberSchema>
