import type { NextFunction, Response } from 'express'
import prisma from '../prisma/client'
import type { AuthenticatedRequest } from '../middlewares/authMiddleware'

export function ensureAuthUser(req: AuthenticatedRequest, res: Response) {
  if (!req.user?.id) {
    res.status(401).json({ message: 'Unauthorized' })
    return null
  }
  return req.user.id
}

export async function getJudgeRounds(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const rounds = await prisma.round.findMany({
      where: {
        Judges: {
          some: {
            userId,
          },
        },
      },
      include: {
        Event: {
          select: {
            id: true,
            name: true,
            eventType: true,
          },
        },
        Quiz: {
           select: {
              id: true,
              name: true,
              completed: true
           }
        },
        Criteria: true
      },
      orderBy: {
        date: 'desc',
      },
    })

    return res.status(200).json({ rounds })
  } catch (error) {
    return next(error)
  }
}

export async function getTeamsByRound(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const eventId = Number(req.params.eventId)
    const roundNo = Number(req.params.roundNo)

    if (!Number.isFinite(eventId) || !Number.isFinite(roundNo)) {
      return res.status(400).json({ message: 'Invalid identifiers' })
    }

    // specific round check if needed, but the query below implicitly checks round association if we filter by round
    
    // Check if user is judge for this round
    const isJudge = await prisma.judge.findUnique({
        where: {
            userId_eventId_roundNo: {
                userId,
                eventId,
                roundNo
            }
        }
    })
    if (!isJudge) return res.status(403).json({ message: 'You are not a judge for this round' })


    // Get teams eligible for this round
    // A team is eligible if they are promoted to this round.
    // Assuming 'roundNo' in Team model indicates the CURRENT active round of the team.
    // So if Team.roundNo == roundNo, they are in this round.
    
    const teams = await prisma.team.findMany({
      where: {
        eventId,
        roundNo, 
        confirmed: true
      },
      include: {
        TeamMembers: {
           include: {
             User: {
                select: {
                    name: true,
                    email: true,
                    phoneNumber: true,
                    id: true
                }
             }
           }
        },
        Score: {
            where: {
                judgeId: userId
            }
        },
        Winner: {
            select: {
               id: true,
               type: true,
               eventId: true,
               teamId: true
            }
        }
      }
    })

    const teamsWithWinners = teams.map(t => ({
        ...t,
        Winners: t.Winner ? [t.Winner] : []
    }))

    return res.status(200).json({ teams: teamsWithWinners })
  } catch (error) {
    return next(error)
  }
}

// Add more judging actions here (submit score etc)
// For now, based on V1 judge tab, likely we need getting teams and submitting scores.

export async function submitScore(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const userId = ensureAuthUser(req, res)
        if (!userId) return

        const eventId = Number(req.params.eventId)
        const roundNo = Number(req.params.roundNo)
        const teamId = Number(req.body.teamId)
        const criteriaId = Number(req.body.criteriaId)
        const scoreVal = String(req.body.score)

        // Validation...
        
        const isJudge = await prisma.judge.findUnique({
             where: { userId_eventId_roundNo: { userId, eventId, roundNo } }
        })
        if (!isJudge) return res.status(403).json({ message: 'Not a judge' })

        // Check if round is completed?
        const round = await prisma.round.findUnique({ where: { eventId_roundNo: { eventId, roundNo } } })
        if (round?.completed) return res.status(400).json({ message: 'Round is completed' })

        await prisma.scores.upsert({
            where: {
                teamId_criteriaId_judgeId: {
                    teamId,
                    criteriaId,
                    judgeId: userId
                }
            },
            update: {
                score: scoreVal
            },
            create: {
                teamId,
                criteriaId,
                judgeId: userId,
                score: scoreVal
            }
        })

        return res.status(200).json({ message: 'Score saved' })

    } catch (error) {
        return next(error)
    }
}

export async function promoteTeam(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const userId = ensureAuthUser(req, res)
        if (!userId) return

        const eventId = Number(req.params.eventId)
        const roundNo = Number(req.params.roundNo)
        const teamId = Number(req.body.teamId)
        const { selected } = req.body

        const isJudge = await prisma.judge.findUnique({ where: { userId_eventId_roundNo: { userId, eventId, roundNo } } })
        // const isOrganiser = ... // Allow organisers too if needed?
        if (!isJudge) return res.status(403).json({ message: 'Not authorized' })
        
        // Logic: specific to implementation. Assuming increasing roundNo.
        // If promoting: roundNo + 1
        // If removing promotion: roundNo - 1 (or specific round check)
        
        await prisma.team.update({
            where: { id: teamId },
            data: {
                roundNo: selected ? roundNo + 1 : roundNo
            }
        })
        
        return res.status(200).json({ message: selected ? 'Team promoted' : 'Team removed from next round' })
    } catch (error) {
        return next(error)
    }
}

export async function selectWinner(req: AuthenticatedRequest, res: Response, next: NextFunction) {
     try {
        const userId = ensureAuthUser(req, res)
        if (!userId) return

        const eventId = Number(req.params.eventId)
        const teamId = Number(req.body.teamId)
        const type = req.body.type // WINNER, RUNNER_UP, etc.

        // Allow judging or require admin/organiser? V1 seemed to allow judges in final round.
        const isJudge = await prisma.judge.findFirst({ where: { userId, eventId } }) 
        if (!isJudge) return res.status(403).json({ message: 'Not authorized' })

        await prisma.winners.create({
            data: {
                eventId,
                teamId,
                type
            }
        })
        return res.status(201).json({ message: 'Winner selected' })
     } catch (error) {
         return next(error)
     }
}

export async function deleteWinner(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
         const userId = ensureAuthUser(req, res)
        if (!userId) return

        const winnerId = Number(req.params.winnerId)
        
        // Auth check...
         const winner = await prisma.winners.findUnique({ where: { id: winnerId } })
         if (!winner) return res.status(404).json({ message: 'Winner not found' })

         const isJudge = await prisma.judge.findFirst({ where: { userId, eventId: winner.eventId } })
         if (!isJudge) return res.status(403).json({ message: 'Not authorized' })

         await prisma.winners.delete({ where: { id: winnerId } })
         
         return res.status(200).json({ message: 'Winner removed' })
    } catch (error) {
        return next(error)
    }
}

export async function updateRoundStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const userId = ensureAuthUser(req, res)
        if (!userId) return

        const eventId = Number(req.params.eventId)
        const roundNo = Number(req.params.roundNo)
        const { selectStatus } = req.body

        const isJudge = await prisma.judge.findUnique({ where: { userId_eventId_roundNo: { userId, eventId, roundNo } } })
         if (!isJudge) return res.status(403).json({ message: 'Not authorized' })

         await prisma.round.update({
             where: { eventId_roundNo: { eventId, roundNo } },
             data: { selectStatus }
         })
         return res.status(200).json({ message: 'Round status updated' })
    } catch (error) {
        return next(error)
    }
}
