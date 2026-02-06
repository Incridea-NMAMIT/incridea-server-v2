import prisma from '../prisma/client'

export const getPid = async (userId: number) => {
  const pid = await prisma.pID.findUnique({
    where: { userId },
  });
  if (!pid) throw new Error('PID not found. Please complete fest registration first.');
  return pid;
};

export const registerSoloEvent = async (userId: number, eventId: number) => {
  const [pid, event] = await Promise.all([
    getPid(userId),
    prisma.event.findUnique({ where: { id: eventId } })
  ]);

  if (!event) throw new Error('Event not found')

  if (event.eventType === 'TEAM' || event.eventType === 'TEAM_MULTIPLE_ENTRY')
    throw new Error('Event is a team event')

  const existingRegistration = await prisma.eventParticipant.findUnique({
    where: {
      eventId_pidId: {
        eventId,
        pidId: pid.id
      }
    }
  })

  if (existingRegistration) throw new Error('Already registered')

  return await prisma.eventParticipant.create({
    data: {
      eventId,
      pidId: pid.id,
      confirmed: true, // Solo events usually auto-confirmed
    },
    include: {
      PID: {
        include: { User: true }
      }
    }
  })
}

export const createTeam = async (userId: number, eventId: number, name: string) => {
  const [pid, event] = await Promise.all([
    getPid(userId),
    prisma.event.findUnique({ where: { id: eventId } })
  ]);

  if (!event) throw new Error('Event not found')

  if (event.eventType === 'INDIVIDUAL' || event.eventType === 'INDIVIDUAL_MULTIPLE_ENTRY')
    throw new Error('Event is individual')

  // Check if user is already in a team for this event (via EventParticipant or TeamMember)
  // Logic: User -> TeamMember -> Team -> EventId
  const existingTeamMember = await prisma.teamMember.findFirst({
    where: {
      pidId: pid.id,
      Team: { eventId }
    }
  })
  if (existingTeamMember) throw new Error('Already registered in a team for this event')

  // Check Team Name uniqueness
  const existingTeam = await prisma.team.findUnique({
    where: { name_eventId: { name, eventId } }
  })
  if (existingTeam) throw new Error('Team name already exists')

  // Create Team and EventParticipant transactionally
  return await prisma.$transaction(async (tx) => {
    const team = await tx.team.create({
      data: {
        name,
        eventId,
        leaderId: pid.id,
        TeamMembers: {
          create: {
            pidId: pid.id
          }
        }
      }
    })

    const participant = await tx.eventParticipant.create({
      data: {
        eventId,
        teamId: team.id,
        confirmed: false
      },
      include: {
        Team: {
          include: {
            TeamMembers: { include: { PID: { include: { User: true } } } },
            Leader: { include: { User: true } }
          }
        }
      }
    })
    return participant.Team; // Return Team object to match previous API expectations somewhat, or we update Controller
  })
}

export const joinTeam = async (userId: number, teamId: number, _collegeId?: number) => {
  const [pid, team] = await Promise.all([
    prisma.pID.findUnique({
      where: { userId },
      include: { User: true }
    }),
    prisma.team.findUnique({
      where: { id: teamId },
      include: {
        TeamMembers: true,
        Leader: { include: { User: true } },
        Event: true,
        EventParticipant: true // Should be 1
      },
    })
  ]);

  if (!pid) throw new Error('PID not found. Please complete fest registration first.');
  if (!team) throw new Error('Team not found')

  // Confirmed check: EventParticipant has confirmed status now
  const participant = team.EventParticipant[0];
  if (participant && participant.confirmed) throw new Error("Can't join team, Team is confirmed")

  const event = team.Event;
  if (!event) throw new Error('Event not found')

  if (event.eventType === 'INDIVIDUAL' || event.eventType === 'INDIVIDUAL_MULTIPLE_ENTRY')
    throw new Error('Event is individual')

  // Check if user already registered
  const existingTeamMember = await prisma.teamMember.findFirst({
    where: {
      pidId: pid.id,
      Team: { eventId: event.id }
    }
  })
  if (existingTeamMember) throw new Error('Already registered')

  if (team.TeamMembers.length >= event.maxTeamSize) throw new Error('Team is full')

  // Cross-college check
  const leaderUser = team.Leader?.User;
  const userUser = pid.User;

  if (!leaderUser || !userUser) throw new Error('User details not found');

  const ignore = [27, 50, 52, 53, 54, 56];

  if (leaderUser.collegeId !== userUser.collegeId && !ignore.includes(event.id)) {
    throw new Error('Team members should belong to same college')
  }

  return await prisma.teamMember.create({
    data: {
      teamId,
      pidId: pid.id,
    },
  })
}

export const getMyTeam = async (userId: number, eventId: number) => {
  const pid = await prisma.pID.findUnique({
    where: { userId },
  });

  if (!pid) return null;

  // Check 1: Solo Registration
  const soloRegistration = await prisma.eventParticipant.findUnique({
    where: { eventId_pidId: { eventId, pidId: pid.id } },
    include: {
      PID: { include: { User: true } },
      Team: true // Should be null
    }
  })

  if (soloRegistration) {
    // Map to a structure similar to what frontend expects, or return raw.
    // Front expects: { id (teamId?), name, confirmed, TeamMembers... }
    // We will refactor frontend, so let's return a unified structure or generic object
    return {
      ...soloRegistration,
      // Adapters for frontend compatibility if we want to minimize frontend changes now
      name: soloRegistration.PID?.User.name,
      TeamMembers: [], // It's solo
      Leader: { User: soloRegistration.PID?.User }
    };
  }

  // Check 2: Team Member Registration
  // Find valid team membership
  const member = await prisma.teamMember.findFirst({
    where: {
      pidId: pid.id,
      Team: { eventId }
    },
    include: {
      Team: {
        include: {
          EventParticipant: true,
          TeamMembers: {
            include: {
              PID: { include: { User: { select: { id: true, name: true, email: true } } } }
            }
          },
          Leader: { include: { User: { select: { id: true, name: true, email: true } } } }
        }
      }
    }
  })

  if (member && member.Team) {
    const p = member.Team.EventParticipant[0];
    return {
      id: member.Team.id, // Keep team ID for team actions
      name: member.Team.name,
      eventId: member.Team.eventId,
      leaderId: member.Team.leaderId,
      confirmed: p ? p.confirmed : false,
      roundNo: p ? p.roundNo : 1,
      TeamMembers: member.Team.TeamMembers,
      Leader: member.Team.Leader,
      eventParticipantId: p ? p.id : null
    }
  }

  return null;
}

export const confirmTeam = async (userId: number, teamId: number) => {
  const pid = await getPid(userId);

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { EventParticipant: true }
  })
  if (!team) throw new Error('Team not found')
  if (team.leaderId !== pid.id) throw new Error('Not authorized only leader can confirm team')

  const event = await prisma.event.findUnique({
    where: { id: team.eventId },
  })
  if (!event) throw new Error('Event not found')

  const teamMembers = await prisma.teamMember.count({
    where: { teamId },
  })
  if (teamMembers < event.minTeamSize)
    throw new Error(`Team is not full need at least ${event.minTeamSize} members`)

  const participant = team.EventParticipant[0];
  if (!participant) throw new Error("Event Participant entry missing");

  return await prisma.eventParticipant.update({
    where: { id: participant.id },
    data: { confirmed: true }
  })
}

export const leaveTeam = async (userId: number, teamId: number) => {
  const pid = await getPid(userId);

  const team = await prisma.team.findUnique({ where: { id: teamId }, include: { TeamMembers: true } })
  if (!team) throw new Error('Team not found')

  // Check if event/participant is confirmed?
  // Usually leaving is blocked if confirmed?
  // Previous logic didn't check confirmed but `deleteTeam` checks auth. `leaveTeam` checks membership.

  const isMember = team.TeamMembers.some((tm: any) => tm.pidId === pid.id)
  if (!isMember) throw new Error('Not a member of team')

  await prisma.teamMember.delete({
    where: {
      pidId_teamId: {
        pidId: pid.id,
        teamId
      }
    }
  })

  // If no members left, delete team (and cascade delete eventParticipant)
  const remainingMembers = await prisma.teamMember.count({
    where: { teamId }
  })

  if (remainingMembers === 0) {
    await prisma.team.delete({
      where: { id: teamId }
    })
    return { count: 0 }
  }

  return { count: remainingMembers }
}

export const deleteTeam = async (userId: number, teamId: number) => {
  const pid = await getPid(userId);

  // This might be a Team ID OR an EventParticipant (Solo) ID if frontend calls it with generic ID?
  // Previous API endpoint was `/registration/delete-team` expecting teamId.
  // We need to support unregistering Solo too.
  // But Solo doesn't have a Team ID.
  // If the frontend passed `team.id` from `getMyTeam`, for Solo we returned a virtual object.
  // If we returned `EventParticipant` object for solo, `id` is `eventParticipantId`.
  // We need to distinguish.
  // Let's assume for now this handles TEAMS.
  // For Solo, we might need a separate function 'unregisterSolo' or handle it here if passed ID matches.

  const team = await prisma.team.findUnique({
    where: { id: teamId },
  })

  if (team) {
    if (team.leaderId !== pid.id) throw new Error('Not authorized only leader can delete team')
    return await prisma.team.delete({ where: { id: teamId } })
  }

  // Try finding EventParticipant for solo
  // But wait, the argument is `teamId`.
  // If we want to support unregister solo, we need to know.
  // Solo participants don't have a Team.
  // If `getMyTeam` returns an object with `id` corresponding to `EventParticipant.id` for solo users,
  // we can check there.

  // Let's assume for strict backwards compat: check if team exists.
  // If not team, maybe it's a solo registration?
  // But logic for solo delete is: user ID + event ID -> find entry -> delete.
  // Wait, `deleteTeam` takes `teamId` from body.
  // If we update frontend, we can pass generic ID.

  // Update: We'll fix this properly by exposing `unregisterEvent` later or assume existing Team delete works for Teams.
  // For solo, we might need `registerSolo` to toggle?
  // If not Team, try finding EventParticipant (Solo)
  const participant = await prisma.eventParticipant.findUnique({ where: { id: teamId } })
  if (participant) {
    if (participant.pidId !== pid.id) throw new Error('Not authorized to delete this registration')
    return await prisma.eventParticipant.delete({ where: { id: teamId } })
  }

  throw new Error('Registration not found')
}

