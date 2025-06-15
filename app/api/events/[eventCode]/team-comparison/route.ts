import { type NextRequest, NextResponse } from "next/server"

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0"

interface TeamStats {
  teamNumber: number
  rank: number | null
  wins: number
  losses: number
  ties: number
  winRate: number
  opr: number
  dpr: number
  ccwm: number
  rp: number
  tbp: number
  matchesPlayed: number
  avgScore: number
  highScore: number
  category: string
  percentile: number
}

interface ComparisonData {
  currentTeam: TeamStats | null
  allTeams: TeamStats[]
  leaderboard: {
    opr: TeamStats[]
    winRate: TeamStats[]
    avgScore: TeamStats[]
  }
  similarTeams: TeamStats[]
}

async function fetchWithAuth(url: string) {
  const username = process.env.FTC_USERNAME
  const apiKey = process.env.FTC_API_KEY

  if (!username || !apiKey) {
    throw new Error("FTC API credentials not configured")
  }

  const credentials = Buffer.from(`${username}:${apiKey}`).toString("base64")

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    throw new Error(`FTC API error: ${response.status}`)
  }

  return response.json()
}

function calculateOPR(matches: any[], teams: number[]) {
  // Simple OPR calculation - in production, use matrix algebra
  const teamStats = new Map<number, { totalScore: number; matches: number; opponentScore: number }>()

  // Initialize team stats
  teams.forEach((team) => {
    teamStats.set(team, { totalScore: 0, matches: 0, opponentScore: 0 })
  })

  // Process qualification matches only
  const qualMatches = matches.filter((match) => match.played && match.tournamentLevel?.toLowerCase().includes("qual"))

  qualMatches.forEach((match) => {
    const redScore = match.scoreRedFinal || match.redScore || 0
    const blueScore = match.scoreBlueFinal || match.blueScore || 0

    // Red alliance
    match.redTeams?.forEach((team: any) => {
      const teamNum = team.teamNumber || team
      if (teamStats.has(teamNum)) {
        const stats = teamStats.get(teamNum)!
        stats.totalScore += redScore
        stats.opponentScore += blueScore
        stats.matches += 1
      }
    })

    // Blue alliance
    match.blueTeams?.forEach((team: any) => {
      const teamNum = team.teamNumber || team
      if (teamStats.has(teamNum)) {
        const stats = teamStats.get(teamNum)!
        stats.totalScore += blueScore
        stats.opponentScore += redScore
        stats.matches += 1
      }
    })
  })

  // Calculate OPR, DPR, CCWM
  const results = new Map<number, { opr: number; dpr: number; ccwm: number }>()

  teamStats.forEach((stats, teamNum) => {
    if (stats.matches > 0) {
      const opr = stats.totalScore / stats.matches
      const dpr = stats.opponentScore / stats.matches
      const ccwm = opr - dpr

      results.set(teamNum, { opr, dpr, ccwm })
    } else {
      results.set(teamNum, { opr: 0, dpr: 0, ccwm: 0 })
    }
  })

  return results
}

function categorizePerformance(percentile: number): string {
  if (percentile >= 90) return "Elite"
  if (percentile >= 75) return "Strong"
  if (percentile >= 50) return "Average"
  if (percentile >= 25) return "Developing"
  return "Needs Work"
}

export async function GET(request: NextRequest, { params }: { params: { eventCode: string } }) {
  try {
    const { eventCode } = params
    const { searchParams } = new URL(request.url)
    const targetTeamNumber = searchParams.get("team")

    console.log(`Fetching team comparison for event: ${eventCode}`)

    // Fetch event data
    const rankingsData = await fetchWithAuth(
      `${FTC_API_BASE}/${process.env.FTC_SEASON || "2024"}/rankings/${eventCode}`,
    )
    const rankings = rankingsData.Rankings || rankingsData.rankings || []

    console.log(`Raw rankings data structure:`, Object.keys(rankingsData))
    console.log(`Found ${rankings.length} rankings`)

    const matchesData = await fetchWithAuth(`${FTC_API_BASE}/${process.env.FTC_SEASON || "2024"}/matches/${eventCode}`)
    const matches = matchesData.matches || matchesData.Matches || []

    console.log(`Found ${matches.length} matches`)

    const teamsData = await fetchWithAuth(
      `${FTC_API_BASE}/${process.env.FTC_SEASON || "2024"}/teams?eventCode=${eventCode}`,
    )
    const teams = teamsData.teams || teamsData.Teams || []

    console.log(`Found ${teams.length} teams`)

    if (rankings.length === 0) {
      return NextResponse.json({
        currentTeam: null,
        allTeams: [],
        leaderboard: { opr: [], winRate: [], avgScore: [] },
        similarTeams: [],
      })
    }

    // Calculate OPR for all teams
    const teamNumbers = teams.map((t: any) => t.teamNumber)
    const oprData = calculateOPR(matches, teamNumbers)

    // Build team stats
    const allTeams: TeamStats[] = rankings.map((ranking: any) => {
      const teamNumber = ranking.teamNumber
      const opr = oprData.get(teamNumber) || { opr: 0, dpr: 0, ccwm: 0 }
      const totalMatches = (ranking.wins || 0) + (ranking.losses || 0) + (ranking.ties || 0)
      const winRate = totalMatches > 0 ? ((ranking.wins || 0) / totalMatches) * 100 : 0

      // Calculate average score from matches
      const teamMatches = matches.filter((match: any) => {
        if (!match.teams || !Array.isArray(match.teams)) return false

        return match.teams.some((t: any) => t.teamNumber === teamNumber)
      })

      console.log(`Found ${teamMatches.length} matches for team ${teamNumber}`)

      let totalScore = 0
      let highScore = 0
      let matchCount = 0

      teamMatches.forEach((match: any) => {
        if (match.played && match.scoreRedFinal !== null && match.scoreBlueFinal !== null) {
          const teamInfo = match.teams.find((t: any) => t.teamNumber === teamNumber)
          if (teamInfo) {
            const isRed = teamInfo.station?.startsWith("Red")
            const score = isRed ? match.scoreRedFinal : match.scoreBlueFinal

            totalScore += score
            highScore = Math.max(highScore, score)
            matchCount++
          }
        }
      })

      const avgScore = matchCount > 0 ? totalScore / matchCount : 0

      return {
        teamNumber,
        rank: ranking.rank,
        wins: ranking.wins || 0,
        losses: ranking.losses || 0,
        ties: ranking.ties || 0,
        winRate,
        opr: opr.opr,
        dpr: opr.dpr,
        ccwm: opr.ccwm,
        rp: ranking.rp || 0,
        tbp: ranking.tbp || 0,
        matchesPlayed: matchCount,
        avgScore,
        highScore,
        category: "",
        percentile: 0,
      }
    })

    // Calculate percentiles and categories
    const sortedByOPR = [...allTeams].sort((a, b) => b.opr - a.opr)
    allTeams.forEach((team) => {
      const oprRank = sortedByOPR.findIndex((t) => t.teamNumber === team.teamNumber) + 1
      team.percentile = ((allTeams.length - oprRank + 1) / allTeams.length) * 100
      team.category = categorizePerformance(team.percentile)
    })

    // Find current team
    let currentTeam = null
    if (targetTeamNumber) {
      currentTeam = allTeams.find((t) => t.teamNumber === Number.parseInt(targetTeamNumber))

      if (!currentTeam) {
        // Team might not be in rankings yet, create a basic entry
        const teamNumber = Number.parseInt(targetTeamNumber)
        const opr = oprData.get(teamNumber) || { opr: 0, dpr: 0, ccwm: 0 }

        currentTeam = {
          teamNumber,
          rank: null,
          wins: 0,
          losses: 0,
          ties: 0,
          winRate: 0,
          opr: opr.opr,
          dpr: opr.dpr,
          ccwm: opr.ccwm,
          rp: 0,
          tbp: 0,
          matchesPlayed: 0,
          avgScore: 0,
          highScore: 0,
          category: "Unranked",
          percentile: 0,
        }
      }
    }

    // Create leaderboards
    const leaderboard = {
      opr: [...allTeams].sort((a, b) => b.opr - a.opr).slice(0, 10),
      winRate: [...allTeams].sort((a, b) => b.winRate - a.winRate).slice(0, 10),
      avgScore: [...allTeams].sort((a, b) => b.avgScore - a.avgScore).slice(0, 10),
    }

    // Find similar teams (within 10 ranks)
    let similarTeams: TeamStats[] = []
    if (currentTeam && currentTeam.rank) {
      similarTeams = allTeams
        .filter((team) => {
          if (!team.rank || team.teamNumber === currentTeam.teamNumber) return false
          return Math.abs(team.rank - currentTeam.rank!) <= 10
        })
        .slice(0, 6)
    }

    const result: ComparisonData = {
      currentTeam: currentTeam,
      allTeams,
      leaderboard,
      similarTeams,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error in team comparison API:", error)
    return NextResponse.json({ error: "Failed to fetch team comparison data" }, { status: 500 })
  }
}
