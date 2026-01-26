import { type Request, type Response } from 'express'
import prisma from '../prisma/client'

export const getStats = async (_req: Request, res: Response) => {
  try {
    // 1. Session Stats
    const activeSessionsCount = await prisma.session.count({
      where: {
        expiresAt: {
          gt: new Date(),
        },
      },
    })

    const activeUsersCount = (
      await prisma.session.findMany({
        where: {
          expiresAt: {
            gt: new Date(),
          },
        },
        distinct: ['userId'],
        select: {
          id: true,
        },
      })
    ).length

    // 2. User Stats Helper
    // We will fetch all users with specific fields to process in memory for graphs
    // If scale becomes an issue, this should be moved to raw SQL aggregation
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        category: true,
        createdAt: true,
      },
    })

    const matchEmail = (email: string, domain: string) => email.toLowerCase().trim().endsWith(domain.toLowerCase())

    // Categories
    const nitteStudents = allUsers.filter((u) => u.category === 'INTERNAL')
    const externalStudents = allUsers.filter((u) => u.category === 'EXTERNAL')
    const alumniStudents = allUsers.filter((u) => u.category === 'ALUMNI')

    // Sub-categories within Nitte/Internal (or general based on email as requested)
    const nmamitStudents = allUsers.filter((u) => matchEmail(u.email, '@nmamit.in'))
    const universityStudents = allUsers.filter((u) => matchEmail(u.email, '@student.nitte.edu.in'))
    const nmitStudents = allUsers.filter((u) => matchEmail(u.email, '@nmit.ac.in'))
    const universityFaculties = allUsers.filter((u) => matchEmail(u.email, '@nitte.edu.in'))

    // 3. Graph Data Generation
    // Helper to group by date (YYYY-MM-DD)
    const groupByDate = (users: typeof allUsers) => {
      const counts: Record<string, number> = {}
      users.forEach((u) => {
        const date = u.createdAt.toISOString().split('T')[0]
        counts[date] = (counts[date] || 0) + 1
      })
      // Convert to array and sort
      return Object.entries(counts)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
    }

    // Cumulative sum for graphs (Growth over time)
    const toCumulative = (data: { date: string; count: number }[]) => {
      let sum = 0
      return data.map((d) => {
        sum += d.count
        return { date: d.date, count: sum }
      })
    }

    const totalUsersGraph = toCumulative(groupByDate(allUsers))
    const nitteGraph = toCumulative(groupByDate(nitteStudents))
    
    const nmamitGraph = toCumulative(groupByDate(nmamitStudents))
    const universityStudentsGraph = toCumulative(groupByDate(universityStudents))
    const nmitGraph = toCumulative(groupByDate(nmitStudents))
    const facultyGraph = toCumulative(groupByDate(universityFaculties))
    
    const externalGraph = toCumulative(groupByDate(externalStudents))
    const alumniGraph = toCumulative(groupByDate(alumniStudents))


    res.json({
      activeSessions: activeSessionsCount,
      activeUsers: activeUsersCount,
      
      totalUsers: allUsers.length,
      totalUsersGraph,

      nitteStudents: nitteStudents.length,
      nitteStudentsGraph: nitteGraph,

      nmamitStudents: nmamitStudents.length,
      nmamitStudentsGraph: nmamitGraph,

      universityStudents: universityStudents.length,
      universityStudentsGraph: universityStudentsGraph,

      nmitStudents: nmitStudents.length,
      nmitStudentsGraph: nmitGraph,

      universityFaculties: universityFaculties.length,
      universityFacultiesGraph: facultyGraph,

      externalStudents: externalStudents.length,
      externalStudentsGraph: externalGraph,

      alumniStudents: alumniStudents.length,
      alumniStudentsGraph: alumniGraph,
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}
