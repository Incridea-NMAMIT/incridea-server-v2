import prisma from '../prisma/client'

const EVENT_DAY_KEYS = ['incrideaDay1', 'incrideaDay2', 'incrideaDay3', 'incrideaDay4'] as const

export type EventDayKey = (typeof EVENT_DAY_KEYS)[number]

function toIsoOrNull(value?: string | null): string | null {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString()
}

export async function listPublishedEvents() {
  const events = await prisma.event.findMany({
    where: { published: true },
    orderBy: [{ tier: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      description: true,
      image: true,
      venue: true,
      fees: true,
      minTeamSize: true,
      maxTeamSize: true,
      maxTeams: true,
      eventType: true,
      category: true,
      Rounds: {
        select: { roundNo: true, date: true },
        orderBy: { roundNo: 'asc' },
      },
    },
  })

  return events.map(({ Rounds, ...rest }) => ({
    ...rest,
    rounds: Rounds,
  }))
}

export async function getEventDayConfig() {
  const variables = await prisma.variable.findMany({
    where: { key: { in: EVENT_DAY_KEYS as unknown as string[] } },
  })

  const defaults: Record<EventDayKey, string> = {
    incrideaDay1: '2026-03-05T00:00:00.000Z',
    incrideaDay2: '2026-03-06T00:00:00.000Z',
    incrideaDay3: '2026-03-07T00:00:00.000Z',
    incrideaDay4: '2026-03-08T00:00:00.000Z',
  }

  const lookup = (key: EventDayKey) =>
    toIsoOrNull(variables.find((variable) => variable.key === key)?.value) ?? defaults[key]

  return {
    day1: lookup('incrideaDay1'),
    day2: lookup('incrideaDay2'),
    day3: lookup('incrideaDay3'),
    day4: lookup('incrideaDay4'),
  }
}

export async function getPublishedEventById(id: number) {
  const event = await prisma.event.findFirst({
    where: { id, published: true },
    select: {
      id: true,
      name: true,
      description: true,
      image: true,
      venue: true,
      fees: true,
      minTeamSize: true,
      maxTeamSize: true,
      maxTeams: true,
      eventType: true,
      category: true,
      Rounds: {
        select: { roundNo: true, date: true },
        orderBy: { roundNo: 'asc' },
      },
      Organizers: {
        select: {
          User: {
            select: {
              name: true,
              email: true,
              phoneNumber: true,
            },
          },
        },
      },
    },
  })

  if (!event) {
    return null
  }

  return {
    ...event,
    rounds: event.Rounds,
    organizers: event.Organizers.map((org) => org.User),
  }
}
