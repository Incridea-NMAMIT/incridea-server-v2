import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: {
      email: {
        startsWith: 'tech',
        endsWith: '@tech.in'
      }
    }
  })

  console.log(`Total Test Users: ${users.length}`)

  let totalRegistrations = 0
  for(const user of users) {
      const pid = await prisma.pID.findUnique({
          where: { userId: user.id }
      })
      
      if(pid) {
          const registrations = await prisma.teamMember.count({
              where: { pidId: pid.id }
          })
        //   console.log(`User ${user.email} has ${registrations} registrations.`)
          totalRegistrations += registrations
      }
  }

  console.log(`Total Registrations for Test Users: ${totalRegistrations}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
