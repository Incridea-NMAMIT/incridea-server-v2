import prisma from '../prisma/client'
import { AppError } from '../utils/appError'
import type { UpdateSettingInput, UpsertVariableInput } from '../schemas/adminSchemas'

export async function listSettings() {
  return prisma.setting.findMany({ orderBy: { key: 'asc' } })
}

export async function updateSetting(key: string, payload: UpdateSettingInput) {
  const existing = await prisma.setting.findUnique({ where: { key } })
  if (!existing) {
    throw new AppError('Setting not found', 404)
  }
  return prisma.setting.update({ where: { key }, data: { value: payload.value } })
}

export async function listVariables() {
  return prisma.variable.findMany({ orderBy: { key: 'asc' } })
}

export async function upsertVariable(key: string, payload: UpsertVariableInput) {
  return prisma.variable.upsert({
    where: { key },
    update: { value: payload.value },
    create: { key, value: payload.value },
  })
}
