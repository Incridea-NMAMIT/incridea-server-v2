import prisma from '../prisma/client'

interface LogPayload {
  message: string
  userId?: number | null
}

function formatMessage(message: string, extra?: Record<string, unknown>) {
  if (!extra || Object.keys(extra).length === 0) {
    return message
  }
  try {
    return `${message} | ${JSON.stringify(extra).slice(0, 1800)}`
  } catch {
    return message
  }
}

export async function logWebEvent(payload: LogPayload, extra?: Record<string, unknown>) {
  try {
    await prisma.webLog.create({
      data: {
        message: formatMessage(payload.message, extra),
        userId: payload.userId ?? null,
      },
    })
  } catch (error) {
    console.error('Failed to write web log', error)
  }
}

export async function listWebLogs(page = 1, pageSize = 50) {
  const take = Math.min(Math.max(pageSize, 1), 200)
  const skip = page > 1 ? (page - 1) * take : 0

  const [logs, total] = await prisma.$transaction([
    prisma.webLog.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.webLog.count(),
  ])

  return {
    logs: logs.map((log) => ({
      id: log.id,
      message: log.message,
      createdAt: log.createdAt,
      user: log.user ? { id: log.user.id, name: log.user.name, email: log.user.email } : null,
    })),
    total,
    page,
    pageSize: take,
  }
}
