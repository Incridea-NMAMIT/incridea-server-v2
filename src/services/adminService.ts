import { Role } from '@prisma/client'
import prisma from '../prisma/client'
import { AppError } from '../utils/appError'
import type { UpdateSettingInput, UpsertVariableInput, UpdateUserRolesInput } from '../schemas/adminSchemas'

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

export async function listUsersWithRoles(search?: string) {
  return prisma.user.findMany({
    where: search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined,
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      UserRoles: { select: { role: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

export async function setUserRoles(userId: number, payload: UpdateUserRolesInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new AppError('User not found', 404)
  }

  // Always ensure USER role remains
  const requestedRoles = Array.from(new Set([...payload.roles, Role.USER]))

  await prisma.$transaction(async (tx) => {
    await tx.userRole.deleteMany({
      where: {
        userId,
        NOT: { role: { in: requestedRoles } },
      },
    })

    for (const role of requestedRoles) {
      await tx.userRole.upsert({
        where: { userId_role: { userId, role } },
        update: {},
        create: { userId, role },
      })
    }
  })

  const roles = await prisma.userRole.findMany({
    where: { userId },
    select: { role: true },
    orderBy: { role: 'asc' },
  })

  return roles.map((r) => r.role)
}
