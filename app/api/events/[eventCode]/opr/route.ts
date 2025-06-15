import { type NextRequest, NextResponse } from "next/server"
import { calculateOPRForMatches } from "@/lib/opr-calculator"

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0"

export async function GET(request: NextRequest, { params }: { params: { eventCode: string } }) {
  const { eventCode } = params

  try {
    const season = 2024
    const auth = Buffer.from(`${process.env.FTC_USERNAME}:${process.env.FTC_API_KEY}`).toString("base64")

    console.log("Calculating OPR for event:", eventCode)

    // Fetch all matches for the event
    const response = await fetch(`${FTC_API_BASE}/${season}/matches/${eventCode.toUpperCase()}`, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Matches API Error:", errorText)
      throw new Error(`Failed to fetch matches: ${response.status}`)
    }

    const data = await response.json()
    const matches = data.matches || []

    console.log(`Processing ${matches.length} total matches for OPR calculation`)

    // Transform matches to our format, ensuring we get non-penalty scores
    const transformedMatches = matches
      .filter((match: any) => match.teams && match.teams.length === 4)
      .map((match: any) => {
        // Use non-penalty scores if available, fallback to final scores
        const redScoreNoFoul =
          match.scoreRedFoul !== undefined
            ? (match.scoreRedFinal || 0) - (match.scoreRedFoul || 0)
            : match.scoreRedFinal || 0

        const blueScoreNoFoul =
          match.scoreBlueFoul !== undefined
            ? (match.scoreBlueFinal || 0) - (match.scoreBlueFoul || 0)
            : match.scoreBlueFinal || 0

        return {
          matchNumber: match.matchNumber,
          red1: match.teams?.find((t: any) => t.station === "Red1")?.teamNumber || 0,
          red2: match.teams?.find((t: any) => t.station === "Red2")?.teamNumber || 0,
          blue1: match.teams?.find((t: any) => t.station === "Blue1")?.teamNumber || 0,
          blue2: match.teams?.find((t: any) => t.station === "Blue2")?.teamNumber || 0,
          redScore: match.scoreRedFinal || 0,
          blueScore: match.scoreBlueFinal || 0,
          redScoreNoFoul,
          blueScoreNoFoul,
          played: match.scoreRedFinal !== null && match.scoreBlueFinal !== null,
          tournamentLevel: match.tournamentLevel || "Qualification",
        }
      })

    console.log(`Transformed ${transformedMatches.length} matches for OPR calculation`)

    // Filter to only qualification matches with valid scores
    const qualificationMatches = transformedMatches.filter(
      (match: any) =>
        match.played &&
        match.redScoreNoFoul !== null &&
        match.blueScoreNoFoul !== null &&
        (match.tournamentLevel === "Qualification" || match.tournamentLevel?.toLowerCase().includes("qual")),
    )

    console.log(`Found ${qualificationMatches.length} valid qualification matches for OPR`)

    if (qualificationMatches.length === 0) {
      console.log("No valid qualification matches found for OPR calculation")
      return NextResponse.json({
        opr: [],
        message: "No completed qualification matches available for OPR calculation",
        matchesProcessed: 0,
        qualificationMatchesUsed: 0,
      })
    }

    // Calculate OPR using our custom algorithm (qualification matches only)
    const oprData = calculateOPRForMatches(transformedMatches)

    console.log(`Calculated OPR for ${oprData.length} teams using ${qualificationMatches.length} qualification matches`)

    // Add some metadata
    const result = {
      opr: oprData,
      matchesProcessed: transformedMatches.length,
      qualificationMatchesUsed: qualificationMatches.length,
      teamsAnalyzed: oprData.length,
      calculationMethod: "custom_matrix_algebra_qualification_only",
      lastUpdated: new Date().toISOString(),
      notes: "OPR calculated using qualification matches only with non-penalty scores",
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error calculating OPR:", error)
    return NextResponse.json(
      {
        opr: [],
        error: "Failed to calculate OPR",
        details: error instanceof Error ? error.message : "Unknown error",
        matchesProcessed: 0,
        qualificationMatchesUsed: 0,
        teamsAnalyzed: 0,
      },
      { status: 500 },
    )
  }
}
