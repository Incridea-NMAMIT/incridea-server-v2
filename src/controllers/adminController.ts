import type { Request, Response, NextFunction } from 'express'
import { Role } from '@prisma/client'
import { listSettings, updateSetting, listVariables, upsertVariable, listUsersWithRoles, setUserRoles } from '../services/adminService'
import { listWebLogs, logWebEvent } from '../services/logService'
import type { UpdateSettingInput, UpsertVariableInput, UpdateUserRolesInput } from '../schemas/adminSchemas'
import type { AuthenticatedRequest } from '../middlewares/authMiddleware'
import { getIO } from '../socket'

export async function getSettings(_req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await listSettings()
    return res.status(200).json({ settings })
  } catch (error) {
    return next(error)
  }
}

export async function putSetting(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { key } = req.params
    const payload = req.body as UpdateSettingInput
    const setting = await updateSetting(key, payload)
    void logWebEvent({
      message: `Setting updated: ${key} -> ${payload.value}`,
      userId: req.user?.id ?? null,
    })
    return res.status(200).json({ setting })
  } catch (error) {
    return next(error)
  }
}

export async function getVariables(_req: Request, res: Response, next: NextFunction) {
  try {
    const variables = await listVariables()
    return res.status(200).json({ variables })
  } catch (error) {
    return next(error)
  }
}

export async function putVariable(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { key } = req.params
    const payload = req.body as UpsertVariableInput
    const variable = await upsertVariable(key, payload)
    void logWebEvent({
      message: `Variable upserted: ${key}`,
      userId: req.user?.id ?? null,
    })
    return res.status(200).json({ variable })
  } catch (error) {
    return next(error)
  }
}

export async function getUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const search = typeof req.query.q === 'string' ? req.query.q.trim() : undefined
    const elevated = req.query.elevated === 'true'
    const users = await listUsersWithRoles(search, elevated)

    return res.status(200).json({
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phoneNumber: u.phoneNumber,
        roles: u.UserRoles.map((r) => r.role),
      })),
      availableRoles: Object.values(Role),
    })
  } catch (error) {
    return next(error)
  }
}

export async function putUserRoles(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = Number(req.params.userId)
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ message: 'Invalid user id' })
    }

    const payload = req.body as UpdateUserRolesInput
    const roles = await setUserRoles(userId, payload)

    void logWebEvent({
      message: `Roles updated for user ${userId}: ${roles.join(',')}`,
      userId: req.user?.id ?? null,
    })

    try {
      getIO().to(`user-${userId}`).emit('ROLE_UPDATED', { roles })
    } catch (error) {
      console.error('Socket notification failed', error)
    }

    return res.status(200).json({ user: { id: userId, roles }, message: 'Roles updated' })
  } catch (error) {
    return next(error)
  }
}

export async function getWebLogs(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const page = Number(req.query.page ?? '1')
    const pageSize = Number(req.query.pageSize ?? '50')
    const logs = await listWebLogs(Number.isFinite(page) && page > 0 ? page : 1, pageSize)
    return res.status(200).json(logs)
  } catch (error) {
    return next(error)
  }
}
