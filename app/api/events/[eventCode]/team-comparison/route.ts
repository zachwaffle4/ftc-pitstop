import { type NextRequest, NextResponse } from "next/server"

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0"

export async function GET(request: NextRequest, { params }: { params: { eventCode: string } }) {
  const { eventCode } = params
  const searchParams = request.nextUrl.searchParams
  const teamNumber = searchParams.get("team")

  try {
    const season = 2024
    const auth = Buffer.from(`${process.env.FTC_USERNAME}:${process.env.FTC_API_KEY}`).toString("base64")

    console.log("Fetching team comparison data for event:", eventCode)

    // Get rankings, matches, and our custom OPR data
    const [rankingsResponse, matchesResponse, oprResponse] = await Promise.all([
      fetch(`${FTC_API_BASE}/${season}/rankings/${eventCode.toUpperCase()}`, {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
        },
      }),
      fetch(`${FTC_API_BASE}/${season}/matches/${eventCode.toUpperCase()}`, {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
        },
      }),
      // Use our custom OPR calculation
      fetch(`${request.nextUrl.origin}/api/events/${eventCode}/opr`),
    ])

    let rankings = []
    let matches = []
    let oprData = []

    if (rankingsResponse.ok) {
      const rankingsResult = await rankingsResponse.json()
      rankings = rankingsResult.Rankings || []
    }

    if (matchesResponse.ok) {
      const matchesResult = await matchesResponse.json()
      matches = matchesResult.matches || []
    }

    if (oprResponse.ok) {
      const oprResult = await oprResponse.json()
      oprData = oprResult.opr || []
    } else {
      console.log("Custom OPR calculation failed, proceeding without OPR data")
    }

    // Create team statistics map
    const teamStats = new Map()

    // Process rankings first - these provide the official rank
    rankings.forEach((ranking: any) => {
      const totalMatches = (ranking.wins || 0) + (ranking.losses || 0) + (ranking.ties || 0)
      const winRate = totalMatches > 0 ? ((ranking.wins || 0) / totalMatches) * 100 : 0

      teamStats.set(ranking.teamNumber, {
        teamNumber: ranking.teamNumber,
        rank: ranking.rank, // Use official rank from rankings
        rp: ranking.rp || 0,
        tbp: ranking.tbp || 0,
        wins: ranking.wins || 0,
        losses: ranking.losses || 0,
        ties: ranking.ties || 0,
        played: totalMatches,
        winRate, // Fixed win rate calculation
        opr: 0,
        dpr: 0,
        ccwm: 0,
        avgScore: 0,
        highScore: 0,
        avgMargin: 0,
        matchesPlayed: 0,
      })
    })

    // Add our custom OPR data
    oprData.forEach((team: any) => {
      if (teamStats.has(team.teamNumber)) {
        const stats = teamStats.get(team.teamNumber)
        stats.opr = team.opr || 0
        stats.dpr = team.dpr || 0
        stats.ccwm = team.ccwm || 0
        stats.matchesPlayed = team.matchesPlayed || 0
      } else {
        // Create entry for teams that might not be in rankings yet
        // Don't assign a rank here - let them be unranked
        teamStats.set(team.teamNumber, {
          teamNumber: team.teamNumber,
          rank: null, // No rank assigned if not in official rankings
          rp: 0,
          tbp: 0,
          wins: 0,
          losses: 0,
          ties: 0,
          played: 0,
          winRate: 0,
          opr: team.opr || 0,
          dpr: team.dpr || 0,
          ccwm: team.ccwm || 0,
          avgScore: 0,
          highScore: 0,
          avgMargin: 0,
          matchesPlayed: team.matchesPlayed || 0,
        })
      }
    })

    // Calculate match-based statistics (using qualification matches only)
    const teamMatchStats = new Map()
    matches
      .filter(
        (match: any) =>
          match.tournamentLevel === "Qualification" || match.tournamentLevel?.toLowerCase().includes("qual"),
      )
      .forEach((match: any) => {
        if (!match.teams || match.scoreRedFinal === null || match.scoreBlueFinal === null) return

        match.teams.forEach((teamInfo: any) => {
          const teamNum = teamInfo.teamNumber
          if (!teamMatchStats.has(teamNum)) {
            teamMatchStats.set(teamNum, {
              scores: [],
              margins: [],
            })
          }

          const isRed = teamInfo.station.includes("Red")
          const teamScore = isRed ? match.scoreRedFinal : match.scoreBlueFinal
          const opponentScore = isRed ? match.scoreBlueFinal : match.scoreRedFinal
          const margin = teamScore - opponentScore

          teamMatchStats.get(teamNum).scores.push(teamScore)
          teamMatchStats.get(teamNum).margins.push(margin)
        })
      })

    // Calculate averages and add to team stats
    teamMatchStats.forEach((matchData, teamNum) => {
      if (teamStats.has(teamNum)) {
        const stats = teamStats.get(teamNum)
        const scores = matchData.scores
        const margins = matchData.margins

        if (scores.length > 0) {
          stats.avgScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length
          stats.highScore = Math.max(...scores)
          stats.avgMargin = margins.reduce((a: number, b: number) => a + b, 0) / margins.length
        }
      }
    })

    // Convert to array and sort by rank (handle null ranks properly)
    const allTeams = Array.from(teamStats.values()).sort((a, b) => {
      // Teams with no rank go to the end
      if (a.rank === null && b.rank === null) return a.teamNumber - b.teamNumber
      if (a.rank === null) return 1
      if (b.rank === null) return -1
      return a.rank - b.rank
    })

    // Find the specific team if requested
    const targetTeam = teamNumber ? allTeams.find((t) => t.teamNumber === Number.parseInt(teamNumber)) : null

    // Calculate percentiles for the target team (only for ranked teams)
    let percentiles = null
    if (targetTeam && targetTeam.rank !== null) {
      const rankedTeams = allTeams.filter((t) => t.rank !== null)

      const calculatePercentile = (value: number, allValues: number[]) => {
        const sorted = allValues.filter((v) => v > 0).sort((a, b) => a - b)
        if (sorted.length === 0) return 0
        const index = sorted.findIndex((v) => v >= value)
        return index === -1 ? 100 : Math.round((index / sorted.length) * 100)
      }

      percentiles = {
        rank: Math.round(((rankedTeams.length - targetTeam.rank + 1) / rankedTeams.length) * 100),
        opr: calculatePercentile(
          targetTeam.opr,
          rankedTeams.map((t) => t.opr),
        ),
        dpr: calculatePercentile(
          targetTeam.dpr,
          rankedTeams.map((t) => t.dpr),
        ), // Higher DPR is better (more points prevented)
        winRate: calculatePercentile(
          targetTeam.winRate,
          rankedTeams.map((t) => t.winRate),
        ),
        avgScore: calculatePercentile(
          targetTeam.avgScore,
          rankedTeams.map((t) => t.avgScore),
        ),
        avgMargin: calculatePercentile(
          targetTeam.avgMargin,
          rankedTeams.map((t) => t.avgMargin),
        ),
      }
    }

    // Get similar teams (teams with similar rank, only for ranked teams)
    const similarTeams =
      targetTeam && targetTeam.rank !== null
        ? allTeams
            .filter(
              (t) =>
                t.teamNumber !== targetTeam.teamNumber && t.rank !== null && Math.abs(t.rank - targetTeam.rank) <= 3,
            )
            .slice(0, 5)
        : []

    // Get top performers in each category (only ranked teams)
    const rankedTeams = allTeams.filter((t) => t.rank !== null)
    const topPerformers = {
      opr: rankedTeams
        .filter((t) => t.opr > 0)
        .sort((a, b) => b.opr - a.opr)
        .slice(0, 5),
      dpr: rankedTeams
        .filter((t) => t.dpr > 0)
        .sort((a, b) => b.dpr - a.dpr) // Higher DPR is better
        .slice(0, 5),
      winRate: rankedTeams
        .filter((t) => t.played >= 3)
        .sort((a, b) => b.winRate - a.winRate)
        .slice(0, 5),
      avgScore: rankedTeams
        .filter((t) => t.avgScore > 0)
        .sort((a, b) => b.avgScore - a.avgScore)
        .slice(0, 5),
      highScore: rankedTeams
        .filter((t) => t.highScore > 0)
        .sort((a, b) => b.highScore - a.highScore)
        .slice(0, 5),
    }

    console.log(`Generated comparison data for ${allTeams.length} teams (${rankedTeams.length} ranked) with custom OPR`)
    return NextResponse.json({
      targetTeam,
      allTeams,
      similarTeams,
      topPerformers,
      percentiles,
      eventStats: {
        totalTeams: allTeams.length,
        rankedTeams: rankedTeams.length,
        avgOPR:
          rankedTeams.filter((t) => t.opr > 0).reduce((sum, t) => sum + t.opr, 0) /
            rankedTeams.filter((t) => t.opr > 0).length || 0,
        avgScore:
          rankedTeams.filter((t) => t.avgScore > 0).reduce((sum, t) => sum + t.avgScore, 0) /
            rankedTeams.filter((t) => t.avgScore > 0).length || 0,
        highestScore: Math.max(...rankedTeams.map((t) => t.highScore)),
      },
      oprCalculation: {
        method: "custom_matrix_algebra_qualification_only",
        matchesProcessed: matches.filter((m: any) => m.scoreRedFinal !== null && m.scoreBlueFinal !== null).length,
        qualificationMatchesUsed: matches.filter(
          (m: any) =>
            (m.tournamentLevel === "Qualification" || m.tournamentLevel?.toLowerCase().includes("qual")) &&
            m.scoreRedFinal !== null &&
            m.scoreBlueFinal !== null,
        ).length,
        teamsAnalyzed: oprData.length,
      },
    })
  } catch (error) {
    console.error("Error generating team comparison:", error)
    return NextResponse.json({
      targetTeam: null,
      allTeams: [],
      similarTeams: [],
      topPerformers: { opr: [], dpr: [], winRate: [], avgScore: [], highScore: [] },
      percentiles: null,
      eventStats: { totalTeams: 0, rankedTeams: 0, avgOPR: 0, avgScore: 0, highestScore: 0 },
      oprCalculation: { method: "failed", matchesProcessed: 0, qualificationMatchesUsed: 0, teamsAnalyzed: 0 },
    })
  }
}
