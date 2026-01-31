import { PrismaClient, EventType } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting registration of test users...')

  // 1. Fetch 50 test users
  const users = await prisma.user.findMany({
    where: {
      email: {
        startsWith: 'tech',
        endsWith: '@tech.in'
      }
    },
    take: 50
  })

  if (users.length === 0) {
    console.error('No test users found. Please run pop-seed.js first.')
    return
  }
  console.log(`Found ${users.length} test users.`)

  // 2. Fetch 5 Individual Events
  const events = await prisma.event.findMany({
    where: {
      eventType: EventType.INDIVIDUAL,
      published: true
    },
    take: 5
  })

  if (events.length < 5) {
    console.warn(`Only found ${events.length} individual events. Registering to available ones.`)
  }

  if (events.length === 0) {
    console.error('No individual events found.')
    return
  }

  // 3. Register users
  for (const user of users) {
    console.log(`Processing User: ${user.name} (${user.id})`)

    // Ensure PID exists
    let pid = await prisma.pID.findUnique({
      where: { userId: user.id }
    })

    if (!pid) {
      const pidCode = `INC24-${user.id.toString().padStart(4, '0')}` // Simple PID generation
      console.log(`  Creating PID for user ${user.id}: ${pidCode}`)
      pid = await prisma.pID.create({
        data: {
            pidCode: pidCode,
            userId: user.id
        }
      })
    }

    for (const event of events) {
        // Check if already registered
        const existingMember = await prisma.teamMember.findFirst({
            where: {
                pidId: pid.id,
                Team: {
                    eventId: event.id
                }
            }
        })

        if(existingMember) {
            // console.log(`  Already registered for event ${event.name}`)
            continue;
        }

        // Create Team (Individual events still use Team model with size 1)
        const teamName = `${user.name}-${event.id}` 
        
        try {
            await prisma.team.create({
                data: {
                    name: teamName,
                    eventId: event.id,
                    confirmed: true,
                    roundNo: 1,
                    TeamMembers: {
                        create: {
                            pidId: pid.id,
                        }
                    }
                }
            })
            console.log(`  Registered for event: ${event.name}`)
        } catch (e) {
            console.error(`  Failed to register for ${event.name}:`, e)
        }
    }
  }

  console.log('Registration complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
