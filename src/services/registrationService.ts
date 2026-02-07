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
      confirmed: true, 
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

  const existingTeamMember = await prisma.teamMember.findFirst({
    where: {
      pidId: pid.id,
      Team: { eventId }
    }
  })
  if (existingTeamMember) throw new Error('Already registered in a team for this event')

  const existingTeam = await prisma.team.findUnique({
    where: { name_eventId: { name, eventId } }
  })
  if (existingTeam) throw new Error('Team name already exists')

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
    return participant.Team; 
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
        EventParticipant: true 
      },
    })
  ]);

  if (!pid) throw new Error('PID not found. Please complete fest registration first.');
  if (!team) throw new Error('Team not found')

  const participant = team.EventParticipant[0];
  if (participant && participant.confirmed) throw new Error("Can't join team, Team is confirmed")

  const event = team.Event;
  if (!event) throw new Error('Event not found')

  if (event.eventType === 'INDIVIDUAL' || event.eventType === 'INDIVIDUAL_MULTIPLE_ENTRY')
    throw new Error('Event is individual')

  const existingTeamMember = await prisma.teamMember.findFirst({
    where: {
      pidId: pid.id,
      Team: { eventId: event.id }
    }
  })
  if (existingTeamMember) throw new Error('Already registered')

  if (team.TeamMembers.length >= event.maxTeamSize) throw new Error('Team is full')

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

  const soloRegistration = await prisma.eventParticipant.findUnique({
    where: { eventId_pidId: { eventId, pidId: pid.id } },
    include: {
      PID: { include: { User: true } },
      Team: true 
    }
  })

  if (soloRegistration) {
    return {
      ...soloRegistration,
      name: soloRegistration.PID?.User.name,
      TeamMembers: [], 
      Leader: { User: soloRegistration.PID?.User }
    };
  }

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
      id: member.Team.id, 
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


  const team = await prisma.team.findUnique({
    where: { id: teamId },
  })

  if (team) {
    if (team.leaderId !== pid.id) throw new Error('Not authorized only leader can delete team')
    return await prisma.team.delete({ where: { id: teamId } })
  }



  const participant = await prisma.eventParticipant.findUnique({ where: { id: teamId } })
  if (participant) {
    if (participant.pidId !== pid.id) throw new Error('Not authorized to delete this registration')
    return await prisma.eventParticipant.delete({ where: { id: teamId } })
  }

  throw new Error('Registration not found')
}

