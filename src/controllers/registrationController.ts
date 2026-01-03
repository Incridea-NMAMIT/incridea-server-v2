import { NextFunction, Request, Response } from 'express'
import { AuthenticatedRequest } from '../middlewares/authMiddleware'
import * as registrationService from '../services/registrationService'

export async function registerSoloEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as AuthenticatedRequest).user?.id
    if (!userId) return res.status(401).json({ message: 'Unauthorized' })
    const { eventId } = req.body
    const team = await registrationService.registerSoloEvent(userId, Number(eventId))
    return res.json(team)
  } catch (error) {
    return next(error)
  }
}

export async function createTeam(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as AuthenticatedRequest).user?.id
    if (!userId) return res.status(401).json({ message: 'Unauthorized' })
    const { eventId, name } = req.body
    const team = await registrationService.createTeam(userId, Number(eventId), name)
    return res.json(team)
  } catch (error) {
    return next(error)
  }
}

export async function joinTeam(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as AuthenticatedRequest).user?.id
    if (!userId) return res.status(401).json({ message: 'Unauthorized' })
    const { teamId } = req.body
    const member = await registrationService.joinTeam(userId, Number(teamId))
    return res.json(member)
  } catch (error) {
    return next(error)
  }
}

export async function getMyTeam(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as AuthenticatedRequest).user?.id
    if (!userId) return res.status(401).json({ message: 'Unauthorized' })
    const { eventId } = req.params
    const team = await registrationService.getMyTeam(userId, Number(eventId))
    return res.json({ team })
  } catch (error) {
    return next(error)
  }
}

export async function confirmTeam(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = (req as AuthenticatedRequest).user?.id
        if (!userId) return res.status(401).json({ message: 'Unauthorized' })
        const { teamId } = req.body
        const team = await registrationService.confirmTeam(userId, Number(teamId))
        return res.json(team)
    } catch (error) {
        return next(error)
    }
}

export async function leaveTeam(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = (req as AuthenticatedRequest).user?.id
        if (!userId) return res.status(401).json({ message: 'Unauthorized' })
        const { teamId } = req.body
        const result = await registrationService.leaveTeam(userId, Number(teamId))
        return res.json(result)
    } catch (error) {
        return next(error)
    }
}

export async function deleteTeam(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = (req as AuthenticatedRequest).user?.id
        if (!userId) return res.status(401).json({ message: 'Unauthorized' })
        const { teamId } = req.body
        const result = await registrationService.deleteTeam(userId, Number(teamId))
        return res.json(result)
    } catch (error) {
        return next(error)
    }
}
