
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Starting venue migration...')

    const schedules = await prisma.eventSchedule.findMany({
        where: {
            venue: { not: null },
            venueId: null
        }
    })

    console.log(`Found ${schedules.length} schedules to migrate.`)

    const venueMap = new Map<string, number>()

    for (const schedule of schedules) {
        if (!schedule.venue) continue

        const venueName = schedule.venue.trim()
        if (!venueName) continue

        let venueId = venueMap.get(venueName)

        if (!venueId) {
            let venue = await prisma.venue.findUnique({
                where: { name: venueName }
            })

            if (!venue) {
                console.log(`Creating venue: ${venueName}`)
                venue = await prisma.venue.create({
                    data: { name: venueName }
                })
            }

            venueId = venue.id
            venueMap.set(venueName, venueId)
        }

        await prisma.eventSchedule.update({
            where: { id: schedule.id },
            data: { venueId: venueId }
        })
    }

    console.log('Venue migration completed.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
