import { type NextRequest, NextResponse } from "next/server"

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0"

export async function GET(request: NextRequest, { params }: { params: { eventCode: string } }) {
  const { eventCode } = params

  try {
    const season = 2024
    const auth = Buffer.from(`${process.env.FTC_USERNAME}:${process.env.FTC_API_KEY}`).toString("base64")

    console.log("Fetching rankings for event:", eventCode)

    const response = await fetch(`${FTC_API_BASE}/${season}/rankings/${eventCode.toUpperCase()}`, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    })

    console.log("Rankings API Response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Rankings API Error:", errorText)

      // Return empty rankings instead of failing
      console.log("Rankings not available, returning empty array")
      return NextResponse.json({ rankings: [] })
    }

    const data = await response.json()
    console.log("Rankings data structure:", {
      hasRankings: !!data.Rankings,
      rankingCount: data.Rankings?.length || 0,
      dataKeys: Object.keys(data),
    })

    // Transform rankings to match our expected format
    const transformedRankings =
      data.Rankings?.map((ranking: any) => ({
        rank: ranking.rank,
        team: ranking.teamNumber,
        rp: ranking.rp || 0,
        tbp: ranking.tbp || 0,
        wins: ranking.wins || 0,
        losses: ranking.losses || 0,
        ties: ranking.ties || 0,
      })) || []

    console.log("Transformed rankings count:", transformedRankings.length)
    return NextResponse.json({ rankings: transformedRankings })
  } catch (error) {
    console.error("Error fetching rankings:", error)
    // Return empty rankings instead of failing
    return NextResponse.json({ rankings: [] })
  }
}
