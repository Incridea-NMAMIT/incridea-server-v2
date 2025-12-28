import type { Request, Response, NextFunction } from 'express'
import { listSettings, updateSetting, listVariables, upsertVariable } from '../services/adminService'
import type { UpdateSettingInput, UpsertVariableInput } from '../schemas/adminSchemas'

export async function getSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await listSettings()
    return res.status(200).json({ settings })
  } catch (error) {
    return next(error)
  }
}

export async function putSetting(req: Request, res: Response, next: NextFunction) {
  try {
    const { key } = req.params
    const payload = req.body as UpdateSettingInput
    const setting = await updateSetting(key, payload)
    return res.status(200).json({ setting })
  } catch (error) {
    return next(error)
  }
}

export async function getVariables(req: Request, res: Response, next: NextFunction) {
  try {
    const variables = await listVariables()
    return res.status(200).json({ variables })
  } catch (error) {
    return next(error)
  }
}

export async function putVariable(req: Request, res: Response, next: NextFunction) {
  try {
    const { key } = req.params
    const payload = req.body as UpsertVariableInput
    const variable = await upsertVariable(key, payload)
    return res.status(200).json({ variable })
  } catch (error) {
    return next(error)
  }
}
