"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  Shield,
  Target,
  Zap,
  BarChart3,
  AlertCircle,
  RefreshCw,
  Info,
} from "lucide-react"

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
}

interface OPRInsightsProps {
  eventCode: string
  teamNumber: number
}

export function OPRInsights({ eventCode, teamNumber }: OPRInsightsProps) {
  const [data, setData] = useState<OPRData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      setError(null)
      setLoading(true)

      const response = await fetch(`/api/events/${eventCode}/opr?team=${teamNumber}`)
      const result = await response.json()

      if (!response.ok) {
        // Handle specific error cases
        if (result.availableTeams) {
          setError(
            `Team ${teamNumber} not found in this event. Available teams include: ${result.availableTeams.join(", ")}${result.totalTeams > 10 ? ` and ${result.totalTeams - 10} more` : ""}.`,
          )
        } else if (result.message) {
          setError(result.message)
        } else {
          setError(`Failed to fetch OPR data: ${response.status}`)
        }
        return
      }

      setData(result)
    } catch (error) {
      console.error("Error fetching OPR insights:", error)
      setError("Failed to load OPR data. Please check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [eventCode, teamNumber])

  const getPerformanceColor = (percentile: number) => {
    if (percentile >= 90) return "text-green-600"
    if (percentile >= 75) return "text-blue-600"
    if (percentile >= 50) return "text-yellow-600"
    if (percentile >= 25) return "text-orange-600"
    return "text-red-600"
  }

  const getPerformanceLevel = (percentile: number) => {
    if (percentile >= 90) return "Elite"
    if (percentile >= 75) return "Strong"
    if (percentile >= 50) return "Average"
    if (percentile >= 25) return "Developing"
    return "Needs Work"
  }

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-600" />
      default:
        return <BarChart3 className="h-4 w-4 text-gray-600" />
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>Calculating OPR insights...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 mb-4">{error || "Failed to load OPR data"}</p>
              <Button onClick={fetchData} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* OPR Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            OPR Analysis for Team {teamNumber}
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            Based on {data.matchesAnalyzed} qualification matches • Last updated:{" "}
            {new Date(data.lastUpdated).toLocaleString()}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            {/* OPR */}
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Zap className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-blue-600">OPR</span>
              </div>
              <div className="text-3xl font-bold text-blue-600 mb-1">{data.opr.toFixed(1)}</div>
              <div className="text-sm text-muted-foreground mb-2">Offensive Power Rating</div>
              <Badge variant="outline">Rank #{data.insights.offensiveRank}</Badge>
              <div className="mt-2">
                <div className="text-xs text-muted-foreground mb-1">
                  vs Event Avg: {data.comparison.avgOPR.toFixed(1)}
                </div>
                <Progress value={(data.opr / data.comparison.topOPR) * 100} className="h-2" />
              </div>
            </div>

            {/* DPR */}
            <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Shield className="h-5 w-5 text-green-600" />
                <span className="font-semibold text-green-600">DPR</span>
              </div>
              <div className="text-3xl font-bold text-green-600 mb-1">{data.dpr.toFixed(1)}</div>
              <div className="text-sm text-muted-foreground mb-2">Defensive Power Rating</div>
              <Badge variant="outline">Rank #{data.insights.defensiveRank}</Badge>
              <div className="mt-2">
                <div className="text-xs text-muted-foreground mb-1">
                  vs Event Avg: {data.comparison.avgDPR.toFixed(1)}
                </div>
                <Progress value={(data.dpr / Math.max(data.comparison.topDPR, 1)) * 100} className="h-2" />
              </div>
            </div>

            {/* CCWM */}
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Target className="h-5 w-5 text-purple-600" />
                <span className="font-semibold text-purple-600">CCWM</span>
              </div>
              <div className="text-3xl font-bold text-purple-600 mb-1">{data.ccwm.toFixed(1)}</div>
              <div className="text-sm text-muted-foreground mb-2">Calculated Contribution to Win Margin</div>
              <Badge variant="outline">Rank #{data.insights.consistencyRank}</Badge>
              <div className="mt-2">
                <div className="text-xs text-muted-foreground mb-1">
                  vs Event Avg: {data.comparison.avgCCWM.toFixed(1)}
                </div>
                <Progress value={Math.max(0, ((data.ccwm + 50) / 100) * 100)} className="h-2" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Insights */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Performance Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-4">
              <div className={`text-2xl font-bold ${getPerformanceColor(data.percentile)}`}>
                {data.insights.category}
              </div>
              <div className="text-sm text-muted-foreground">{data.percentile.toFixed(0)}th percentile</div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Overall Performance</span>
                  <span>{data.percentile.toFixed(0)}%</span>
                </div>
                <Progress value={data.percentile} className="h-2" />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="p-2 bg-green-50 dark:bg-green-950 rounded">
                  <div className="font-semibold text-green-600">{data.breakdown.strongMatches}</div>
                  <div className="text-xs text-muted-foreground">Strong</div>
                </div>
                <div className="p-2 bg-yellow-50 dark:bg-yellow-950 rounded">
                  <div className="font-semibold text-yellow-600">{data.breakdown.averageMatches}</div>
                  <div className="text-xs text-muted-foreground">Average</div>
                </div>
                <div className="p-2 bg-red-50 dark:bg-red-950 rounded">
                  <div className="font-semibold text-red-600">{data.breakdown.weakMatches}</div>
                  <div className="text-xs text-muted-foreground">Weak</div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                {getTrendIcon(data.breakdown.trendDirection)}
                <span className="text-sm font-medium">
                  Performance Trend:{" "}
                  {data.breakdown.trendDirection.charAt(0).toUpperCase() + data.breakdown.trendDirection.slice(1)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Strengths & Areas for Improvement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-green-600 mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Strengths
                </h4>
                <div className="space-y-1">
                  {data.insights.strengths.map((strength, index) => (
                    <div key={index} className="text-sm p-2 bg-green-50 dark:bg-green-950 rounded">
                      {strength}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-orange-600 mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Areas for Improvement
                </h4>
                <div className="space-y-1">
                  {data.insights.improvements.map((improvement, index) => (
                    <div key={index} className="text-sm p-2 bg-orange-50 dark:bg-orange-950 rounded">
                      {improvement}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* OPR Explanation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Understanding OPR Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="font-semibold text-blue-600 mb-2">OPR (Offensive Power Rating)</div>
              <p className="text-muted-foreground">
                Measures how many points a team contributes to their alliance's score on average. Higher values indicate
                stronger offensive capabilities.
              </p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="font-semibold text-green-600 mb-2">DPR (Defensive Power Rating)</div>
              <p className="text-muted-foreground">
                Measures how many points a team prevents opponents from scoring through defense. Higher values indicate
                better defensive play.
              </p>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
              <div className="font-semibold text-purple-600 mb-2">CCWM (Calculated Contribution to Win Margin)</div>
              <p className="text-muted-foreground">
                Combines offensive and defensive contributions to show overall impact on match outcomes. Positive values
                help win matches.
              </p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-xs text-muted-foreground">
              <strong>Note:</strong> OPR calculations are based on{" "}
              {data.qualificationMatchesOnly ? "qualification matches only" : "all completed matches"}
              and use non-penalty scores when available. Statistics are updated after each match and may fluctuate as
              more data becomes available.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
