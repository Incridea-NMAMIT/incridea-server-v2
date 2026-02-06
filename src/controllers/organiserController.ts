import type { NextFunction, Response } from 'express'
import prisma from '../prisma/client'
import type { AuthenticatedRequest } from '../middlewares/authMiddleware'
import type { CreateTeamInput, AddTeamMemberInput, MarkAttendanceInput, CreateQuizInput, UpdateOrganiserProfileInput, UpdateQuizInput } from '../schemas/organiserSchemas'
// UpdateQuizInput seems missing in schema export based on error, removing it from import for now to check if it fixes build, 
// or I will add it if I see it in view_file.
// Wait, I saw it in view_file Step 820: "export type UpdateQuizInput = z.infer<typeof updateQuizSchema>".
// Maybe I messed up the file content in Step 826?
// The diff showed:
// -export type UpdateQuizInput = z.infer<typeof updateQuizSchema>
// +
// +export const updateOrganiserProfileSchema ...
// +export type UpdateOrganiserProfileInput ...
// Ah! I accidentally REMOVED `export type UpdateQuizInput` in Step 826 because I targeted it as "TargetContent" and replaced it with new schema WITHOUT including it back!
// I must restore UpdateQuizInput.
import { logWebEvent } from '../services/logService'
import { getIO } from '../socket'
import { getPid } from '../services/registrationService'

export function ensureAuthUser(req: AuthenticatedRequest, res: Response) {
  if (!req.user?.id) {
    res.status(401).json({ message: 'Unauthorized' })
    return null
  }
  return req.user.id
}

// Helper to verify if user is an organiser for the specific event
async function ensureOrganiserForEvent(userId: number, eventId: number) {
  const organiser = await prisma.organiser.findUnique({
    where: {
      userId_eventId: {
        userId,
        eventId,
      },
    },
  })
  return !!organiser
}

export async function updateOrganiserProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const { name, phoneNumber } = req.body as UpdateOrganiserProfileInput

    // Update all organiser entries for this user
    await prisma.organiser.updateMany({
      where: { userId },
      data: { name, phoneNumber }
    })

    void logWebEvent({
      message: `Organiser updated profile(Name: ${name}, Phone: ${phoneNumber})`,
      userId
    })

    return res.status(200).json({ message: 'Profile updated' })

  } catch (error) {
    return next(error)
  }
}

export async function listOrganiserEvents(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const events = await prisma.event.findMany({
      where: {
        Organisers: {
          some: {
            userId,
          },
        },
      },
      select: {
        id: true,
        name: true,
        eventType: true,
        category: true,
        Schedule: {
          select: { Venue: { select: { id: true, name: true } }, day: true, startTime: true, endTime: true },
        },
        published: true,
        _count: {
          select: {
            EventParticipants: true, // Updated count
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    return res.status(200).json({
      events: events.map(e => ({
        ...e,
        venue: e.Schedule[0]?.Venue ?? null,
        schedules: e.Schedule,
        registrations: e._count.EventParticipants // Expose as registrations
      }))
    })
  } catch (error) {
    return next(error)
  }
}

export async function getOrganiserEventDetails(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const eventId = Number(req.params.eventId)
    if (!Number.isFinite(eventId)) {
      return res.status(400).json({ message: 'Invalid event id' })
    }

    const isOrganiser = await ensureOrganiserForEvent(userId, eventId)
    if (!isOrganiser) {
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { UserRoles: true } })
      const isAdmin = user?.UserRoles.some((ur: { role: string }) => ur.role === 'ADMIN')
      if (!isAdmin) {
        return res.status(403).json({ message: 'You are not an organiser for this event' })
      }
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        Schedule: {
          include: {
            Venue: {
              select: { id: true, name: true }
            }
          }
        },
        // Include EventParticipants to support both structures
        EventParticipants: {
          include: {
            Team: {
              include: {
                TeamMembers: {
                  include: {
                    PID: {
                      include: {
                        User: {
                          select: {
                            id: true,
                            name: true,
                            email: true,
                            phoneNumber: true,
                            collegeId: true,
                            College: { select: { name: true } }
                          }
                        }
                      }
                    }
                  }
                },
                Leader: { include: { User: true } }
              }
            },
            PID: { // For Solo
              include: {
                User: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    phoneNumber: true,
                    collegeId: true,
                    College: { select: { name: true } }
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        Rounds: {
          orderBy: {
            roundNo: 'asc'
          },
          include: {
            Judges: {
              include: {
                User: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    phoneNumber: true
                  }
                }
              }
            },
            Criteria: true,
            Quiz: true
          }
        }
      },
    })

    if (!event) {
      return res.status(404).json({ message: 'Event not found' })
    }

    // Transform eventParticipants to a "Teams-like" structure for frontend compatibility if needed,
    // or return both.
    // The current frontend uses `event.Teams`.
    // We can map `eventParticipants` to `Teams`.
    const mappedTeams = event.EventParticipants.map(ep => {
      if (ep.Team) {
        return {
          ...ep.Team,
          roundNo: ep.roundNo,
          confirmed: ep.confirmed,
          attended: ep.attended,
          eventParticipantId: ep.id
        }
      } else if (ep.PID) {
        // Create a virtual team for Solo
        return {
          id: ep.id, // Use EP ID as ID for solo? Or generic ID.
          // CAUTION: If frontend expects `Team.id` to match `Team` table, using EP ID might confuse if we mix.
          // But for Solo, there is no Team table entry.
          name: ep.PID.User.name,
          roundNo: ep.roundNo,
          confirmed: ep.confirmed,
          attended: ep.attended,
          eventId: event.id,
          leaderId: ep.PID.id,
          TeamMembers: [{
            id: 0, // Virtual ID
            teamId: 0,
            pidId: ep.PID.id,
            PID: ep.PID
          }],
          eventParticipantId: ep.id,
          isSolo: true // Flag to help frontend
        }
      }
      return null
    }).filter(Boolean)

    return res.status(200).json({
      event: {
        ...event,
        venue: event.Schedule[0]?.Venue ?? null,
        schedules: event.Schedule,
        Teams: mappedTeams // Overwrite with mapped list
      }
    })
  } catch (error) {
    return next(error)
  }
}

export async function createTeam(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const eventId = Number(req.params.eventId)
    if (!Number.isFinite(eventId)) return res.status(400).json({ message: 'Invalid event id' })

    const payload = req.body as CreateTeamInput

    const isOrganiser = await ensureOrganiserForEvent(userId, eventId)
    if (!isOrganiser) {
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { UserRoles: true } })
      const isAdmin = user?.UserRoles.some((ur: { role: string }) => ur.role === 'ADMIN')
      if (!isAdmin) return res.status(403).json({ message: 'Forbidden' })
    }

    // Check if team name exists
    const existingTeam = await prisma.team.findUnique({
      where: {
        name_eventId: {
          name: payload.name,
          eventId
        }
      }
    })
    if (existingTeam) return res.status(400).json({ message: 'Team name already exists' })

    // Create Team and EventParticipant
    const result = await prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          name: payload.name,
          eventId,
          // confirmed: true, // Removed from Team model
        },
        include: {
          TeamMembers: {
            include: {
              PID: {
                include: {
                  User: true
                }
              }
            }
          }
        }
      })

      await tx.eventParticipant.create({
        data: {
          eventId,
          teamId: team.id,
          confirmed: true, // Organisers create confirmed teams
          roundNo: 1
        }
      })
      return team;
    })

    void logWebEvent({
      message: `Organiser created team ${result.name} (${result.id}) for event ${eventId}`,
      userId,
    })

    return res.status(201).json({ team: result })
  } catch (error) {
    return next(error)
  }
}

// deleteTeam... (No change needed as it uses Team ID from params and cascades)
// But wait, if deleteTeam is called for Solo (mapped ID), it fails.
// Organiser typically manages Teams.
// If we listed Solo participants as "Teams", we should handle their deletion too.
// The `deleteTeam` function in `organiserController` takes `teamId`.
// I should update it to support EventParticipant deletion similar to registrationService.

export async function deleteTeam(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const teamId = Number(req.params.teamId)
    if (!Number.isFinite(teamId)) return res.status(400).json({ message: 'Invalid team id' })

    // Check if it's a Team
    const team = await prisma.team.findUnique({ where: { id: teamId } })

    let eventId = team?.eventId;
    let isTeam = !!team;

    if (!team) {
      // Check if it's an EventParticipant (Solo)
      const participant = await prisma.eventParticipant.findUnique({ where: { id: teamId } })
      if (participant) {
        eventId = participant.eventId;
        isTeam = false;
      } else {
        return res.status(404).json({ message: 'Team/Participant not found' })
      }
    }

    if (!eventId) return res.status(404).json({ message: 'Event not found' })

    const isOrganiser = await ensureOrganiserForEvent(userId, eventId)
    if (!isOrganiser) {
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { UserRoles: true } })
      const isAdmin = user?.UserRoles.some((ur: { role: string }) => ur.role === 'ADMIN')
      if (!isAdmin) return res.status(403).json({ message: 'Forbidden' })
    }

    if (isTeam) {
      await prisma.team.delete({ where: { id: teamId } })
      void logWebEvent({ message: `Organiser deleted team ${teamId}`, userId })
    } else {
      await prisma.eventParticipant.delete({ where: { id: teamId } })
      void logWebEvent({ message: `Organiser deleted participant ${teamId}`, userId })
    }

    return res.status(200).json({ message: 'Team deleted' })
  } catch (error) {
    return next(error)
  }
}

export async function addTeamMember(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const teamId = Number(req.params.teamId)
    const { userId: memberUserId } = req.body as AddTeamMemberInput

    // Verify organiser logic omitted for brevity? No, must ensure organiser.
    // But wait, existing code assumes ensureOrganiserForEvent checked?
    // Route uses `requireOrganiser` middleware but that checks EVENT.
    // We have teamId. We need to find eventId from teamId to check auth.

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { TeamMembers: true }
    })

    if (!team) return res.status(404).json({ message: 'Team not found' })

    const isOrganiser = await ensureOrganiserForEvent(userId, team.eventId)
    if (!isOrganiser) {
      // Admin check?
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { UserRoles: true } })
      const isAdmin = user?.UserRoles.some((ur) => ur.role === 'ADMIN')
      if (!isAdmin) return res.status(403).json({ message: 'Forbidden' })
    }

    // Check if user already in team
    if (team.TeamMembers.some(tm => tm.userId === memberUserId)) {
      return res.status(400).json({ message: 'User already in team' })
    }

    // Check Team Limit
    const event = await prisma.event.findUnique({ where: { id: team.eventId } })
    if (event && team.TeamMembers.length >= event.maxTeamSize) {
      return res.status(400).json({ message: 'Team is full' })
    }

    const pid = await getPid(memberUserId)
    await prisma.teamMember.create({
      data: {
        teamId,
        userId: memberUserId,
        pidId: pid.id
      }
    })

    return res.status(201).json({ message: 'Member added' })
  } catch (error) {
    return next(error)
  }
}

export async function removeTeamMember(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const teamId = Number(req.params.teamId)
    const memberUserId = Number(req.params.userId)

    const team = await prisma.team.findUnique({ where: { id: teamId } })
    if (!team) return res.status(404).json({ message: 'Team not found' })

    const isOrganiser = await ensureOrganiserForEvent(userId, team.eventId)
    if (!isOrganiser) {
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { UserRoles: true } })
      const isAdmin = user?.UserRoles.some((ur) => ur.role === 'ADMIN')
      if (!isAdmin) return res.status(403).json({ message: 'Forbidden' })
    }

    await prisma.teamMember.deleteMany({
      where: {
        teamId,
        userId: memberUserId
      }
    })

    return res.json({ message: 'Member removed' })
  } catch (error) {
    return next(error)
  }
}

export async function markAttendance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const teamId = Number(req.params.teamId) // This matches frontend calling /team/:teamId/attendance
    if (!Number.isFinite(teamId)) return res.status(400).json({ message: 'Invalid team id' })

    const { attended } = req.body as MarkAttendanceInput

    // Find EventParticipant. It could be linked to a Team (teamId check) OR be a direct EventParticipant (if teamId passed is EP ID for solo)
    // Scenario 1: teamId is actual Team ID.
    let participant = await prisma.eventParticipant.findFirst({
      where: { teamId }
    })

    // Scenario 2: teamId is EventParticipant ID (Solo)
    if (!participant) {
      participant = await prisma.eventParticipant.findUnique({ where: { id: teamId } })
    }

    if (!participant) return res.status(404).json({ message: 'Participant not found' })

    const team = participant.teamId ? await prisma.team.findUnique({ where: { id: participant.teamId } }) : null

    const isOrganiser = await ensureOrganiserForEvent(userId, participant.eventId)
    if (!isOrganiser) {
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { UserRoles: true } })
      const isAdmin = user?.UserRoles.some((ur: { role: string }) => ur.role === 'ADMIN')
      if (!isAdmin) return res.status(403).json({ message: 'Forbidden' })
    }

    await prisma.eventParticipant.update({
      where: { id: participant.id },
      data: { attended }
    })

    void logWebEvent({
      message: `Organiser marked attendance for ${team ? 'team ' + team.name : 'participant ' + participant.id} to ${attended} `,
      userId
    })

    return res.status(200).json({ message: 'Attendance updated' })
  } catch (error) {
    return next(error)
  }
}

export async function createRound(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const eventId = Number(req.params.eventId)
    if (!Number.isFinite(eventId)) return res.status(400).json({ message: 'Invalid event id' })

    const isOrganiser = await ensureOrganiserForEvent(userId, eventId)
    if (!isOrganiser) {
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { UserRoles: true } })
      const isAdmin = user?.UserRoles.some((ur: { role: string }) => ur.role === 'ADMIN')
      if (!isAdmin) return res.status(403).json({ message: 'Forbidden' })
    }

    // Determine next round number
    const lastRound = await prisma.round.findFirst({
      where: { eventId },
      orderBy: { roundNo: 'desc' }
    })
    const nextRoundNo = (lastRound?.roundNo || 0) + 1

    const round = await prisma.round.create({
      data: {
        eventId,
        roundNo: nextRoundNo,
        date: new Date() // Default to now, expecting update later
      }
    })

    void logWebEvent({
      message: `Organiser created round ${round.roundNo} for event ${eventId}`,
      userId
    })

    return res.status(201).json({ round })
  } catch (error) {
    return next(error)
  }
}

export async function deleteRound(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const eventId = Number(req.params.eventId)
    const roundNo = Number(req.params.roundNo)

    if (!Number.isFinite(eventId) || !Number.isFinite(roundNo)) return res.status(400).json({ message: 'Invalid identifiers' })

    const isOrganiser = await ensureOrganiserForEvent(userId, eventId)
    if (!isOrganiser) {
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { UserRoles: true } })
      const isAdmin = user?.UserRoles.some((ur: { role: string }) => ur.role === 'ADMIN')
      if (!isAdmin) return res.status(403).json({ message: 'Forbidden' })
    }

    await prisma.round.delete({
      where: {
        eventId_roundNo: {
          eventId,
          roundNo
        }
      }
    })

    void logWebEvent({
      message: `Organiser deleted round ${roundNo} for event ${eventId}`,
      userId
    })

    return res.status(200).json({ message: 'Round deleted' })
  } catch (error) {
    return next(error)
  }
}

export async function addJudge(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const eventId = Number(req.params.eventId)
    const roundNo = Number(req.params.roundNo)
    const { userId: judgeUserId } = req.body

    if (!Number.isFinite(eventId) || !Number.isFinite(roundNo) || !judgeUserId) return res.status(400).json({ message: 'Invalid input' })

    const isOrganiser = await ensureOrganiserForEvent(userId, eventId)
    if (!isOrganiser) {
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { UserRoles: true } })
      const isAdmin = user?.UserRoles.some((ur: { role: string }) => ur.role === 'ADMIN')
      if (!isAdmin) return res.status(403).json({ message: 'Forbidden' })
    }

    // Ensure user exists
    const judgeUser = await prisma.user.findUnique({ where: { id: judgeUserId } })
    if (!judgeUser) return res.status(404).json({ message: 'User not found' })

    // Check if already judge
    const existingJudge = await prisma.judge.findUnique({
      where: {
        userId_eventId_roundNo: {
          userId: judgeUserId,
          eventId,
          roundNo
        }
      }
    })
    if (existingJudge) return res.status(400).json({ message: 'User is already a judge for this round' })

    await prisma.judge.create({
      data: {
        eventId,
        roundNo,
        userId: judgeUserId
      }
    })

    void logWebEvent({
      message: `Organiser ${userId} added judge ${judgeUserId} to event ${eventId} round ${roundNo} `,
      userId,
    })

    return res.status(201).json({ message: 'Judge added' })
  } catch (error) {
    return next(error)
  }
}

export async function removeJudge(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const eventId = Number(req.params.eventId)
    const roundNo = Number(req.params.roundNo)
    const judgeUserId = Number(req.params.judgeUserId)

    const isOrganiser = await ensureOrganiserForEvent(userId, eventId)
    if (!isOrganiser) {
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { UserRoles: true } })
      const isAdmin = user?.UserRoles.some((ur: { role: string }) => ur.role === 'ADMIN')
      if (!isAdmin) return res.status(403).json({ message: 'Forbidden' })
    }

    await prisma.judge.delete({
      where: {
        userId_eventId_roundNo: {
          userId: judgeUserId,
          eventId,
          roundNo
        }
      }
    })

    void logWebEvent({
      message: `Organiser ${userId} removed judge ${judgeUserId} from event ${eventId} round ${roundNo} `,
      userId,
    })

    return res.status(200).json({ message: 'Judge removed' })
  } catch (error) {
    return next(error)
  }
}

export async function addCriteria(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const eventId = Number(req.params.eventId)
    const roundNo = Number(req.params.roundNo)
    const { name, scoreOutOf } = req.body

    const isOrganiser = await ensureOrganiserForEvent(userId, eventId)
    if (!isOrganiser) {
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { UserRoles: true } })
      const isAdmin = user?.UserRoles.some((ur: { role: string }) => ur.role === 'ADMIN')
      if (!isAdmin) return res.status(403).json({ message: 'Forbidden' })
    }

    const criteria = await prisma.criteria.create({
      data: {
        eventId,
        roundNo,
        name,
        scoreOutOf: Number(scoreOutOf) || 10
      }
    })

    void logWebEvent({
      message: `Organiser ${userId} added criteria "${criteria.name}"(${criteria.id}) to event ${eventId} round ${roundNo} `,
      userId,
    })

    return res.status(201).json({ criteria })
  } catch (error) {
    return next(error)
  }
}

export async function deleteCriteria(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const eventId = Number(req.params.eventId)
    const criteriaId = Number(req.params.criteriaId)

    if (!Number.isFinite(eventId) || !Number.isFinite(criteriaId)) return res.status(400).json({ message: 'Invalid identifiers' })

    const isOrganiser = await ensureOrganiserForEvent(userId, eventId)
    if (!isOrganiser) {
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { UserRoles: true } })
      const isAdmin = user?.UserRoles.some((ur: { role: string }) => ur.role === 'ADMIN')
      if (!isAdmin) return res.status(403).json({ message: 'Forbidden' })
    }

    await prisma.criteria.delete({ where: { id: criteriaId } })

    void logWebEvent({
      message: `Organiser ${userId} deleted criteria ${criteriaId} from event ${eventId} `,
      userId,
    })

    return res.status(200).json({ message: 'Criteria deleted' })
  } catch (error) {
    return next(error)
  }
}
// ... existing code ...

export async function createQuiz(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const eventId = Number(req.params.eventId)
    const roundId = Number(req.params.roundId)

    if (!Number.isFinite(eventId) || !Number.isFinite(roundId)) {
      return res.status(400).json({ message: 'Invalid ID' })
    }

    const { name, description, startTime, endTime, password, overridePassword } = req.body as CreateQuizInput

    const isOrganiser = await ensureOrganiserForEvent(userId, eventId)
    if (!isOrganiser) {
      // Allow Admins?
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { UserRoles: true } })
      const isAdmin = user?.UserRoles.some((ur) => ur.role === 'ADMIN')
      if (!isAdmin) return res.status(403).json({ message: 'Forbidden' })
    }

    const quiz = await prisma.quiz.create({
      data: {
        name,
        description,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        password,
        overridePassword: overridePassword ?? '',
        eventId,
        roundId,
      },
    })

    try {
      getIO().to(`event - ${eventId} `).emit('QUIZ_UPDATED', {
        eventId,
        roundId,
        quizId: quiz.id
      })
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Socket notification failed', error)
    }

    return res.status(201).json({ quiz })
  } catch (error) {
    return next(error)
  }
}

export async function getQuiz(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const eventId = Number(req.params.eventId)
    const roundId = Number(req.params.roundId)

    if (!Number.isFinite(eventId) || !Number.isFinite(roundId)) {
      return res.status(400).json({ message: 'Invalid ID' })
    }

    // Auth check
    const isOrganiser = await ensureOrganiserForEvent(userId, eventId)
    if (!isOrganiser) {
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { UserRoles: true } })
      const isAdmin = user?.UserRoles.some((ur) => ur.role === 'ADMIN')
      if (!isAdmin) return res.status(403).json({ message: 'Forbidden' })
    }

    const quiz = await prisma.quiz.findUnique({
      where: {
        eventId_roundId: {
          eventId,
          roundId,
        },
      },
      include: {
        Questions: {
          include: {
            options: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    })

    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' })
    }

    return res.status(200).json({ quiz })
  } catch (error) {
    return next(error)
  }
}

export async function updateQuiz(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const eventId = Number(req.params.eventId)
    // const roundId = Number(req.params.roundId)
    const quizId = req.params.quizId

    if (!Number.isFinite(eventId) || !quizId) {
      return res.status(400).json({ message: 'Invalid ID' })
    }

    const { name, description, startTime, endTime, password, overridePassword, questions } = req.body as UpdateQuizInput
    console.log('UpdateQuiz Payload:', { quizId, startTime, endTime })

    const isOrganiser = await ensureOrganiserForEvent(userId, eventId)
    if (!isOrganiser) {
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { UserRoles: true } })
      const isAdmin = user?.UserRoles.some((ur) => ur.role === 'ADMIN')
      if (!isAdmin) return res.status(403).json({ message: 'Forbidden' })
    }

    // Transaction to handle nested updates safely
    const updatedQuiz = await prisma.$transaction(async (tx) => {
      // 1. Update basic quiz details
      const quiz = await tx.quiz.update({
        where: { id: quizId },
        data: {
          name,
          description,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          password,
          overridePassword: overridePassword ?? '',
        },
      })

      // 2. Handle Questions
      // Fetch existing question IDs with a single query to avoid repeated scans
      const existingQuestions = await tx.question.findMany({
        where: { quizId },
        select: { id: true },
      })
      const existingQuestionIds = new Set(existingQuestions.map((q) => q.id))

      const incomingQuestionIds = new Set(questions.filter((q) => q.id).map((q) => q.id as string))

      // Delete questions that are not in the incoming list
      const questionsToDelete = [...existingQuestionIds].filter((id) => !incomingQuestionIds.has(id))
      if (questionsToDelete.length > 0) {
        await tx.question.deleteMany({
          where: { id: { in: questionsToDelete } },
        })
      }

      // Upsert questions (update existing or create new)
      for (const q of questions) {
        if (q.id && existingQuestionIds.has(q.id)) {
          // Update existing question
          await tx.question.update({
            where: { id: q.id },
            data: {
              question: q.question,
              description: q.description,
              isCode: q.isCode,
              image: q.image,
            },
          })

          // Handle Options for this question
          // Delete old options
          await tx.options.deleteMany({ where: { questionId: q.id } })
          // Create new options
          if (q.options.length > 0) {
            await tx.options.createMany({
              data: q.options.map(opt => ({
                value: opt.value,
                isAnswer: opt.isAnswer,
                questionId: q.id!
              }))
            })
          }

        } else {
          // Create new question
          await tx.question.create({
            data: {
              quizId,
              question: q.question,
              description: q.description,
              isCode: q.isCode,
              image: q.image,
              options: {
                create: q.options.map(opt => ({
                  value: opt.value,
                  isAnswer: opt.isAnswer
                }))
              }
            },
          })
        }
      }

      return quiz
    })

    try {
      getIO().to(`event - ${eventId} `).emit('QUIZ_UPDATED', {
        eventId,
        quizId
      })
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Socket notification failed', error)
    }

    return res.status(200).json({ quiz: updatedQuiz })
  } catch (error) {
    return next(error)
  }
}

export async function deleteQuiz(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const eventId = Number(req.params.eventId)
    const quizId = req.params.quizId

    // Auth check
    const isOrganiser = await ensureOrganiserForEvent(userId, eventId)
    if (!isOrganiser) {
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { UserRoles: true } })
      const isAdmin = user?.UserRoles.some((ur) => ur.role === 'ADMIN')
      if (!isAdmin) return res.status(403).json({ message: 'Forbidden' })
    }

    await prisma.quiz.delete({
      where: { id: quizId }
    })

    try {
      getIO().to(`event - ${eventId} `).emit('QUIZ_UPDATED', {
        eventId,
        quizId
      })
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Socket notification failed', error)
    }

    return res.status(200).json({ message: 'Quiz deleted' })
  } catch (error) {
    return next(error)
  }
}

export async function getQuizLeaderboard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const eventId = Number(req.params.eventId)
    const roundId = Number(req.params.roundId)
    if (!Number.isFinite(eventId) || !Number.isFinite(roundId)) return res.status(400).json({ message: 'Invalid ID' })

    const isOrganiser = await ensureOrganiserForEvent(userId, eventId)
    if (!isOrganiser) {
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { UserRoles: true } })
      const isAdmin = user?.UserRoles.some((ur) => ur.role === 'ADMIN')
      if (!isAdmin) return res.status(403).json({ message: 'Forbidden' })
    }

    const quiz = await prisma.quiz.findUnique({
      where: { eventId_roundId: { eventId, roundId } },
      include: {
        QuizScores: {
          include: {
            team: true
          },
          orderBy: [
            { score: 'desc' },
            { timeTaken: 'asc' }
          ]
        }
      }
    })

    if (!quiz) return res.status(404).json({ message: 'Quiz not found' })

    return res.json({ leaderboard: (quiz as any).QuizScores })
  } catch (error) {
    return next(error)
  }
}

export async function promoteParticipants(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const eventId = Number(req.params.eventId)
    const roundId = Number(req.params.roundId) // This is current round number
    if (!Number.isFinite(eventId) || !Number.isFinite(roundId)) return res.status(400).json({ message: 'Invalid ID' })

    const { teamIds } = req.body as { teamIds: number[] }

    const isOrganiser = await ensureOrganiserForEvent(userId, eventId)
    if (!isOrganiser) {
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { UserRoles: true } })
      const isAdmin = user?.UserRoles.some((ur) => ur.role === 'ADMIN')
      if (!isAdmin) return res.status(403).json({ message: 'Forbidden' })
    }

    // Promote teams to next round logic
    // Standard logic: Update `roundNo` of Team? Or create new round entry?
    // In `Team` model: `roundNo` field.
    // Logic: Update `roundNo` to current round + 1.

    const nextRoundNo = roundId + 1

    // Verify next round exists?
    // Usually we just increment.

    // Update EventParticipants (since teamIds are actually eventParticipantIds)
    await prisma.eventParticipant.updateMany({
      where: {
        id: { in: teamIds },
        eventId,
        roundNo: roundId // Ensure they are in current round
      },
      data: {
        roundNo: nextRoundNo
      }
    })

    return res.json({ message: 'Participants promoted' })

  } catch (error) {
    return next(error)
  }
}

export async function toggleEventStart(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const eventId = Number(req.params.eventId)
    if (!Number.isFinite(eventId)) return res.status(400).json({ message: 'Invalid event id' })

    const { isStarted } = req.body

    const isOrganiser = await ensureOrganiserForEvent(userId, eventId)
    if (!isOrganiser) {
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { UserRoles: true } })
      const isAdmin = user?.UserRoles.some((ur) => ur.role === 'ADMIN')
      if (!isAdmin) return res.status(403).json({ message: 'Forbidden' })
    }

    const event = await prisma.event.update({
      where: { id: eventId },
      data: { isStarted: Boolean(isStarted) }
    })

    if (isStarted) {
      // Reset all rounds to not completed
      await prisma.round.updateMany({
        where: { eventId },
        data: { isCompleted: false }
      })
    }

    void logWebEvent({
      message: `Organiser ${isStarted ? 'started' : 'stopped'} event ${eventId} `,
      userId
    })

    return res.status(200).json({ event })
  } catch (error) {
    return next(error)
  }
}

export async function setActiveRound(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = ensureAuthUser(req, res)
    if (!userId) return

    const eventId = Number(req.params.eventId)
    const roundNo = Number(req.body.roundNo)

    if (!Number.isFinite(eventId) || !Number.isFinite(roundNo)) return res.status(400).json({ message: 'Invalid identifiers' })

    const isOrganiser = await ensureOrganiserForEvent(userId, eventId)
    if (!isOrganiser) {
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { UserRoles: true } })
      const isAdmin = user?.UserRoles.some((ur) => ur.role === 'ADMIN')
      if (!isAdmin) return res.status(403).json({ message: 'Forbidden' })
    }

    // Mark previous completed
    await prisma.round.updateMany({
      where: {
        eventId,
        roundNo: { lt: roundNo }
      },
      data: { isCompleted: true }
    })

    // Mark current and future incomplete
    await prisma.round.updateMany({
      where: {
        eventId,
        roundNo: { gte: roundNo }
      },
      data: { isCompleted: false }
    })

    void logWebEvent({
      message: `Organiser set active round to ${roundNo} for event ${eventId}`,
      userId
    })

    return res.status(200).json({ message: 'Active round updated' })

  } catch (error) {
    return next(error)
  }
}

export async function searchUsers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const q = req.query.q as string
    if (!q) return res.json([])

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } }
        ]
      },
      take: 10,
      select: { id: true, name: true, email: true }
    })
    return res.json(users)
  } catch (error) {
    return next(error)
  }
}
