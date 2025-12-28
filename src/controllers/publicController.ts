import type { Request, Response, NextFunction } from 'express'
import { listSettings, listVariables } from '../services/adminService'
import {
  getEventDayConfig,
  getPublishedEventById as fetchPublishedEventById,
  listPublishedEvents,
} from '../services/eventService'

const REG_FEE_KEYS = [
  'internalRegistrationFeeGen',
  'internalRegistrationFeeInclusiveMerch',
  'externalRegistrationFee',
  'externalRegistrationFeeOnSpot',
  'internalRegistrationOnSpot',
  'alumniRegistrationFee',
] as const

type FeeKey = (typeof REG_FEE_KEYS)[number]

type Fees = Record<FeeKey, number>

function toNumber(value: string | undefined | null): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function getRegistrationConfig(_req: Request, res: Response, next: NextFunction) {
  try {
    const [settings, variables] = await Promise.all([listSettings(), listVariables()])

    const isRegistrationOpen = Boolean(settings.find((s) => s.key === 'isRegistrationOpen')?.value)
    const isSpotRegistration = Boolean(settings.find((s) => s.key === 'isSpotRegistration')?.value)

    const feeMap: Fees = REG_FEE_KEYS.reduce((acc, key) => {
      acc[key] = toNumber(variables.find((variable) => variable.key === key)?.value)
      return acc
    }, {} as Fees)

    return res.status(200).json({ isRegistrationOpen, isSpotRegistration, fees: feeMap })
  } catch (error) {
    return next(error)
  }
}

export async function getPublishedEvents(_req: Request, res: Response, next: NextFunction) {
  try {
    const [events, days] = await Promise.all([listPublishedEvents(), getEventDayConfig()])

    return res.status(200).json({ events, days })
  } catch (error) {
    return next(error)
  }
}

export async function getPublishedEventById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: 'Invalid event id' })
    }

    const event = await fetchPublishedEventById(id)
    if (!event) {
      return res.status(404).json({ message: 'Event not found' })
    }

    return res.status(200).json({ event })
  } catch (error) {
    return next(error)
  }
}
