import { type NextRequest, NextResponse } from "next/server"

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0"

interface OPRData {
  teamNumber: number
  opr: number
  dpr: number
  ccwm: number
  rank: number
  percentile: number
  matchesAnalyzed: number
  qualificationMatchesOnly: boolean
  lastUpdated: string
  insights: {
    offensiveRank: number
    defensiveRank: number
    consistencyRank: number
    category: string
    strengths: string[]
    improvements: string[]
  }
  comparison: {
    avgOPR: number
    avgDPR: number
    avgCCWM: number
    topOPR: number
    topDPR: number
    topCCWM: number
  }
  breakdown: {
    strongMatches: number
    averageMatches: number
    weakMatches: number
    trendDirection: "up" | "down" | "stable"
  }
  debug?: {
    totalMatches: number
    qualMatches: number
    teamMatches: number
    teamsFound: number[]
    matrixSize: string
    sampleMatch: any
  }
}

async function fetchWithAuth(url: string) {
  const username = process.env.FTC_USERNAME
  const apiKey = process.env.FTC_API_KEY

  if (!username || !apiKey) {
    throw new Error("FTC API credentials not configured")
  }

  const credentials = Buffer.from(`${username}:${apiKey}`).toString("base64")

  console.log(`Fetching: ${url}`)

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`FTC API error for ${url}:`, response.status, errorText)
    throw new Error(`FTC API error: ${response.status}`)
  }

  return response.json()
}

function calculateOPRMatrix(matches: any[], targetTeam?: number) {
  console.log(`\n=== STARTING OPR MATRIX CALCULATION ===`)
  console.log(`Total matches received: ${matches.length}`)

  // Filter for qualification matches with valid scores
  const qualMatches = matches.filter((match) => {
    // Check if match has actual scores (not null/undefined and not 0,0)
    const hasValidScores =
      (match.scoreRedFinal !== null &&
        match.scoreRedFinal !== undefined &&
        match.scoreBlueFinal !== null &&
        match.scoreBlueFinal !== undefined) ||
      (match.scoreRedNoFoul !== null &&
        match.scoreRedNoFoul !== undefined &&
        match.scoreBlueNoFoul !== null &&
        match.scoreBlueNoFoul !== undefined)

    // Check if it's a qualification match
    const isQual =
      match.tournamentLevel === "Qualification" ||
      match.description?.toLowerCase().includes("qual") ||
      match.matchNumber <= 100 // Most quals are numbered 1-100

    // Check if match has been played (either played=true OR has non-zero scores)
    const redScore = match.scoreRedNoFoul ?? match.scoreRedFinal ?? 0
    const blueScore = match.scoreBlueNoFoul ?? match.scoreBlueFinal ?? 0
    const hasNonZeroScores = redScore > 0 || blueScore > 0
    const isPlayed = match.played === true || hasNonZeroScores

    console.log(
      `Match ${match.matchNumber}: played=${match.played}, hasValidScores=${hasValidScores}, isQual=${isQual}, scores=${redScore}-${blueScore}, isPlayed=${isPlayed}`,
    )

    return isPlayed && hasValidScores && isQual
  })

  console.log(`Qualification matches found: ${qualMatches.length}`)

  if (qualMatches.length === 0) {
    console.log(`❌ NO QUALIFICATION MATCHES FOUND!`)
    return { results: new Map(), debug: { qualMatches: 0, teamsFound: [], matrixSize: "0x0" } }
  }

  // Extract all teams and build team index using direct team fields
  const teamSet = new Set<number>()
  const matchData: Array<{
    redTeams: number[]
    blueTeams: number[]
    redScore: number
    blueScore: number
    matchNumber: number
  }> = []

  console.log(`\n=== EXTRACTING TEAMS FROM MATCHES ===`)

  qualMatches.forEach((match, index) => {
    console.log(`\nProcessing Match ${match.matchNumber} (${index + 1}/${qualMatches.length})`)

    // Use non-penalty scores if available, otherwise use final scores
    const redScore = match.scoreRedNoFoul ?? match.scoreRedFinal ?? 0
    const blueScore = match.scoreBlueNoFoul ?? match.scoreBlueFinal ?? 0

    console.log(`Scores: Red=${redScore}, Blue=${blueScore}`)

    // Extract teams directly from red1, red2, blue1, blue2 fields
    const redTeams: number[] = []
    const blueTeams: number[] = []

    if (match.red1 && !isNaN(match.red1)) {
      redTeams.push(match.red1)
      teamSet.add(match.red1)
    }
    if (match.red2 && !isNaN(match.red2)) {
      redTeams.push(match.red2)
      teamSet.add(match.red2)
    }
    if (match.blue1 && !isNaN(match.blue1)) {
      blueTeams.push(match.blue1)
      teamSet.add(match.blue1)
    }
    if (match.blue2 && !isNaN(match.blue2)) {
      blueTeams.push(match.blue2)
      teamSet.add(match.blue2)
    }

    console.log(`Extracted - Red: [${redTeams}], Blue: [${blueTeams}]`)

    if (redTeams.length > 0 && blueTeams.length > 0) {
      matchData.push({
        redTeams,
        blueTeams,
        redScore,
        blueScore,
        matchNumber: match.matchNumber,
      })

      console.log(`✅ Match ${match.matchNumber} processed successfully`)
    } else {
      console.log(`❌ No teams found in match ${match.matchNumber}`)
      console.log(`Match data:`, { red1: match.red1, red2: match.red2, blue1: match.blue1, blue2: match.blue2 })
    }
  })

  const teams = Array.from(teamSet).sort((a, b) => a - b)
  console.log(`\n=== TEAMS EXTRACTED ===`)
  console.log(`Total teams found: ${teams.length}`)
  console.log(`Teams: [${teams.slice(0, 10).join(", ")}${teams.length > 10 ? "..." : ""}]`)

  if (targetTeam) {
    const targetFound = teams.includes(targetTeam)
    console.log(`Target team ${targetTeam} found: ${targetFound}`)
    if (!targetFound) {
      console.log(`❌ Target team ${targetTeam} not found in any qualification matches`)
      return {
        results: new Map(),
        debug: {
          qualMatches: qualMatches.length,
          teamsFound: teams.slice(0, 10),
          matrixSize: `${teams.length}x${matchData.length}`,
          sampleMatch: qualMatches[0]
            ? {
                matchNumber: qualMatches[0].matchNumber,
                red1: qualMatches[0].red1,
                red2: qualMatches[0].red2,
                blue1: qualMatches[0].blue1,
                blue2: qualMatches[0].blue2,
                redScore: qualMatches[0].scoreRedNoFoul ?? qualMatches[0].scoreRedFinal,
                blueScore: qualMatches[0].scoreBlueNoFoul ?? qualMatches[0].scoreBlueFinal,
              }
            : null,
        },
      }
    }
  }

  if (teams.length === 0 || matchData.length === 0) {
    console.log(`❌ Insufficient data for OPR calculation`)
    return {
      results: new Map(),
      debug: {
        qualMatches: qualMatches.length,
        teamsFound: teams,
        matrixSize: "0x0",
        sampleMatch: qualMatches[0] || null,
      },
    }
  }

  console.log(`\n=== BUILDING OPR MATRIX ===`)
  console.log(`Matrix dimensions: ${teams.length} teams x ${matchData.length * 2} equations`)

  // Build the matrix for least squares: A * x = b
  // Where A is the alliance matrix, x is the OPR vector, b is the score vector
  const numTeams = teams.length
  const numEquations = matchData.length * 2 // Red and blue for each match

  // Create team index mapping
  const teamIndex = new Map<number, number>()
  teams.forEach((team, index) => {
    teamIndex.set(team, index)
  })

  // Build matrix A and vector b
  const A: number[][] = []
  const b: number[] = []

  matchData.forEach((match) => {
    // Red alliance equation
    const redRow = new Array(numTeams).fill(0)
    match.redTeams.forEach((team) => {
      const idx = teamIndex.get(team)
      if (idx !== undefined) {
        redRow[idx] = 1
      }
    })
    A.push(redRow)
    b.push(match.redScore)

    // Blue alliance equation
    const blueRow = new Array(numTeams).fill(0)
    match.blueTeams.forEach((team) => {
      const idx = teamIndex.get(team)
      if (idx !== undefined) {
        blueRow[idx] = 1
      }
    })
    A.push(blueRow)
    b.push(match.blueScore)
  })

  console.log(`Matrix A: ${A.length}x${A[0]?.length || 0}`)
  console.log(`Vector b: ${b.length} elements`)

  // Solve using least squares: x = (A^T * A)^(-1) * A^T * b
  console.log(`\n=== SOLVING LEAST SQUARES ===`)

  try {
    const opr = solveLeastSquares(A, b)
    console.log(`✅ OPR calculation successful`)

    // Calculate DPR (defensive contribution)
    const dpr = calculateDPR(A, b, opr, matchData, teamIndex)

    // Build results
    const results = new Map<
      number,
      {
        opr: number
        dpr: number
        ccwm: number
        matchScores: number[]
        matches: number
      }
    >()

    teams.forEach((team, index) => {
      const teamOPR = opr[index] || 0
      const teamDPR = dpr[index] || 0
      const ccwm = teamOPR - teamDPR

      // Get match scores for this team
      const matchScores: number[] = []
      matchData.forEach((match) => {
        if (match.redTeams.includes(team)) {
          matchScores.push(match.redScore)
        } else if (match.blueTeams.includes(team)) {
          matchScores.push(match.blueScore)
        }
      })

      results.set(team, {
        opr: teamOPR,
        dpr: teamDPR,
        ccwm,
        matchScores,
        matches: matchScores.length,
      })

      if (team === targetTeam) {
        console.log(`\n🎯 TARGET TEAM ${targetTeam} RESULTS:`)
        console.log(`  OPR: ${teamOPR.toFixed(2)}`)
        console.log(`  DPR: ${teamDPR.toFixed(2)}`)
        console.log(`  CCWM: ${ccwm.toFixed(2)}`)
        console.log(`  Matches: ${matchScores.length}`)
        console.log(`  Match Scores: [${matchScores.join(", ")}]`)
      }
    })

    console.log(`\n=== OPR CALCULATION COMPLETE ===`)
    console.log(`Teams with OPR: ${results.size}`)

    return {
      results,
      debug: {
        qualMatches: qualMatches.length,
        teamsFound: teams.slice(0, 10),
        matrixSize: `${numTeams}x${numEquations}`,
        totalMatches: matches.length,
        teamMatches: matchData.length,
        sampleMatch: matchData[0] || null,
      },
    }
  } catch (error) {
    console.error(`❌ Matrix calculation failed:`, error)
    return {
      results: new Map(),
      debug: {
        qualMatches: qualMatches.length,
        teamsFound: teams.slice(0, 10),
        matrixSize: `${numTeams}x${numEquations}`,
        error: error instanceof Error ? error.message : "Unknown error",
        sampleMatch: qualMatches[0] || null,
      },
    }
  }
}

function solveLeastSquares(A: number[][], b: number[]): number[] {
  // Solve A * x = b using normal equations: (A^T * A) * x = A^T * b
  const m = A.length // number of equations
  const n = A[0]?.length || 0 // number of variables (teams)

  if (n === 0 || m === 0) {
    throw new Error("Empty matrix")
  }

  // Calculate A^T
  const AT: number[][] = []
  for (let i = 0; i < n; i++) {
    AT[i] = []
    for (let j = 0; j < m; j++) {
      AT[i][j] = A[j][i]
    }
  }

  // Calculate A^T * A
  const ATA: number[][] = []
  for (let i = 0; i < n; i++) {
    ATA[i] = []
    for (let j = 0; j < n; j++) {
      let sum = 0
      for (let k = 0; k < m; k++) {
        sum += AT[i][k] * A[k][j]
      }
      ATA[i][j] = sum
    }
  }

  // Calculate A^T * b
  const ATb: number[] = []
  for (let i = 0; i < n; i++) {
    let sum = 0
    for (let j = 0; j < m; j++) {
      sum += AT[i][j] * b[j]
    }
    ATb[i] = sum
  }

  // Solve ATA * x = ATb using Gaussian elimination
  return gaussianElimination(ATA, ATb)
}

function gaussianElimination(A: number[][], b: number[]): number[] {
  const n = A.length
  const augmented: number[][] = []

  // Create augmented matrix
  for (let i = 0; i < n; i++) {
    augmented[i] = [...A[i], b[i]]
  }

  // Forward elimination
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k
      }
    }

    // Swap rows
    if (maxRow !== i) {
      ;[augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]]
    }

    // Check for singular matrix
    if (Math.abs(augmented[i][i]) < 1e-10) {
      // Use regularization for singular/near-singular matrices
      augmented[i][i] += 1e-6
    }

    // Eliminate column
    for (let k = i + 1; k < n; k++) {
      const factor = augmented[k][i] / augmented[i][i]
      for (let j = i; j <= n; j++) {
        augmented[k][j] -= factor * augmented[i][j]
      }
    }
  }

  // Back substitution
  const x: number[] = new Array(n)
  for (let i = n - 1; i >= 0; i--) {
    x[i] = augmented[i][n]
    for (let j = i + 1; j < n; j++) {
      x[i] -= augmented[i][j] * x[j]
    }
    x[i] /= augmented[i][i]
  }

  return x
}

function calculateDPR(
  A: number[][],
  b: number[],
  opr: number[],
  matchData: any[],
  teamIndex: Map<number, number>,
): number[] {
  // DPR calculation: how much a team reduces opponent scoring
  // We'll use a simplified approach: DPR = average opponent score when team is present - event average
  const teams = Array.from(teamIndex.keys())
  const dpr: number[] = new Array(teams.length).fill(0)

  // Calculate event average score
  const totalScore = b.reduce((sum, score) => sum + score, 0)
  const eventAvg = totalScore / b.length

  teams.forEach((team, teamIdx) => {
    let opponentScoreSum = 0
    let opponentMatches = 0

    matchData.forEach((match) => {
      if (match.redTeams.includes(team)) {
        // Team is on red, opponent score is blue
        opponentScoreSum += match.blueScore
        opponentMatches++
      } else if (match.blueTeams.includes(team)) {
        // Team is on blue, opponent score is red
        opponentScoreSum += match.redScore
        opponentMatches++
      }
    })

    if (opponentMatches > 0) {
      const avgOpponentScore = opponentScoreSum / opponentMatches
      // DPR is how much below average the opponents score
      dpr[teamIdx] = Math.max(0, eventAvg - avgOpponentScore)
    }
  })

  return dpr
}

function analyzePerformance(matchScores: number[], avgScore: number) {
  if (matchScores.length === 0) {
    return {
      strongMatches: 0,
      averageMatches: 0,
      weakMatches: 0,
      trendDirection: "stable" as const,
    }
  }

  const threshold = Math.max(avgScore * 0.2, 10)
  let strongMatches = 0
  let averageMatches = 0
  let weakMatches = 0

  matchScores.forEach((score) => {
    if (score > avgScore + threshold) strongMatches++
    else if (score < avgScore - threshold) weakMatches++
    else averageMatches++
  })

  let trendDirection: "up" | "down" | "stable" = "stable"
  if (matchScores.length >= 4) {
    const midPoint = Math.floor(matchScores.length / 2)
    const firstHalf = matchScores.slice(0, midPoint)
    const secondHalf = matchScores.slice(midPoint)

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

    if (secondAvg > firstAvg * 1.15) trendDirection = "up"
    else if (secondAvg < firstAvg * 0.85) trendDirection = "down"
  }

  return {
    strongMatches,
    averageMatches,
    weakMatches,
    trendDirection,
  }
}

function generateInsights(opr: number, dpr: number, ccwm: number, percentile: number) {
  const strengths: string[] = []
  const improvements: string[] = []

  if (opr > 60) strengths.push("Excellent offensive scoring ability")
  else if (opr > 40) strengths.push("Solid offensive contribution")
  else if (opr > 20) strengths.push("Contributing to alliance scoring")
  else improvements.push("Focus on improving scoring consistency")

  if (dpr > 15) strengths.push("Strong defensive impact")
  else if (dpr > 5) strengths.push("Good defensive awareness")
  else improvements.push("Work on defensive positioning and strategy")

  if (ccwm > 10) strengths.push("Significant positive impact on match outcomes")
  else if (ccwm > 0) strengths.push("Positive contribution to alliance success")
  else improvements.push("Focus on overall match contribution and consistency")

  if (percentile > 80) strengths.push("Top-tier performance at this event")
  else if (percentile > 60) strengths.push("Above-average performance")
  else if (percentile < 30) improvements.push("Significant room for improvement")

  if (strengths.length === 0) strengths.push("Participating and gaining valuable experience")
  if (improvements.length === 0) improvements.push("Continue building on current strengths")

  return { strengths, improvements }
}

export async function GET(request: NextRequest, { params }: { params: { eventCode: string } }) {
  try {
    const { eventCode } = params
    const { searchParams } = new URL(request.url)
    const targetTeamNumber = searchParams.get("team")

    if (!targetTeamNumber) {
      return NextResponse.json({ error: "Team number is required" }, { status: 400 })
    }

    const targetTeam = Number.parseInt(targetTeamNumber)
    console.log(`\n🔍 STARTING OPR ANALYSIS for team ${targetTeam} at event: ${eventCode}`)

    const season = process.env.FTC_SEASON || "2024"

    try {
      const matchesData = await fetchWithAuth(`${FTC_API_BASE}/${season}/matches/${eventCode.toUpperCase()}`)
      const matches = matchesData.matches || matchesData.Matches || []

      console.log(`📊 Found ${matches.length} total matches`)

      if (matches.length === 0) {
        return NextResponse.json(
          {
            error: "No match data available",
            message: "This event may not have started yet or match data is not available.",
            teamNumber: targetTeam,
            matchesAnalyzed: 0,
          },
          { status: 404 },
        )
      }

      const { results: oprResults, debug } = calculateOPRMatrix(matches, targetTeam)

      if (oprResults.size === 0) {
        return NextResponse.json(
          {
            error: "No OPR data could be calculated",
            message: "No qualification matches with valid scores and teams found.",
            teamNumber: targetTeam,
            matchesAnalyzed: 0,
            debug,
          },
          { status: 404 },
        )
      }

      const teamOPR = oprResults.get(targetTeam)
      if (!teamOPR) {
        const availableTeams = Array.from(oprResults.keys()).sort((a, b) => a - b)
        return NextResponse.json(
          {
            error: "Team not found in match data",
            message: `Team ${targetTeam} has not played any qualification matches at this event.`,
            teamNumber: targetTeam,
            availableTeams: availableTeams.slice(0, 10),
            totalTeams: availableTeams.length,
            matchesAnalyzed: 0,
            debug,
          },
          { status: 404 },
        )
      }

      // Calculate rankings and percentiles
      const allOPRs = Array.from(oprResults.values())
        .map((r) => r.opr)
        .sort((a, b) => b - a)
      const allDPRs = Array.from(oprResults.values())
        .map((r) => r.dpr)
        .sort((a, b) => b - a)
      const allCCWMs = Array.from(oprResults.values())
        .map((r) => r.ccwm)
        .sort((a, b) => b - a)

      const oprRank = allOPRs.findIndex((opr) => opr <= teamOPR.opr) + 1
      const dprRank = allDPRs.findIndex((dpr) => dpr <= teamOPR.dpr) + 1
      const ccwmRank = allCCWMs.findIndex((ccwm) => ccwm <= teamOPR.ccwm) + 1

      const percentile = ((allOPRs.length - oprRank + 1) / allOPRs.length) * 100

      const breakdown = analyzePerformance(teamOPR.matchScores, teamOPR.opr)
      const insights = generateInsights(teamOPR.opr, teamOPR.dpr, teamOPR.ccwm, percentile)

      const avgOPR = allOPRs.reduce((a, b) => a + b, 0) / allOPRs.length
      const avgDPR = allDPRs.reduce((a, b) => a + b, 0) / allDPRs.length
      const avgCCWM = allCCWMs.reduce((a, b) => a + b, 0) / allCCWMs.length

      const result: OPRData = {
        teamNumber: targetTeam,
        opr: Math.round(teamOPR.opr * 10) / 10,
        dpr: Math.round(teamOPR.dpr * 10) / 10,
        ccwm: Math.round(teamOPR.ccwm * 10) / 10,
        rank: oprRank,
        percentile: Math.round(percentile * 10) / 10,
        matchesAnalyzed: teamOPR.matches,
        qualificationMatchesOnly: true,
        lastUpdated: new Date().toISOString(),
        insights: {
          offensiveRank: oprRank,
          defensiveRank: dprRank,
          consistencyRank: ccwmRank,
          category:
            percentile >= 90
              ? "Elite"
              : percentile >= 75
                ? "Strong"
                : percentile >= 50
                  ? "Average"
                  : percentile >= 25
                    ? "Developing"
                    : "Needs Work",
          strengths: insights.strengths,
          improvements: insights.improvements,
        },
        comparison: {
          avgOPR: Math.round(avgOPR * 10) / 10,
          avgDPR: Math.round(avgDPR * 10) / 10,
          avgCCWM: Math.round(avgCCWM * 10) / 10,
          topOPR: Math.round(Math.max(...allOPRs) * 10) / 10,
          topDPR: Math.round(Math.max(...allDPRs) * 10) / 10,
          topCCWM: Math.round(Math.max(...allCCWMs) * 10) / 10,
        },
        breakdown,
        debug,
      }

      console.log(
        `✅ SUCCESS: OPR=${result.opr}, DPR=${result.dpr}, CCWM=${result.ccwm}, matches=${result.matchesAnalyzed}`,
      )
      return NextResponse.json(result)
    } catch (apiError) {
      console.error("FTC API Error:", apiError)
      return NextResponse.json(
        {
          error: "Failed to fetch event data",
          message: "Could not retrieve match data from FTC API. The event may not exist or API may be unavailable.",
          teamNumber: targetTeam,
          matchesAnalyzed: 0,
        },
        { status: 404 },
      )
    }
  } catch (error) {
    console.error("Error in OPR API:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: "An unexpected error occurred while calculating OPR data.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
