"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
  Target,
  Zap,
  Users,
  AlertCircle,
  RefreshCw,
} from "lucide-react"

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
  currentTeam: TeamStats
  allTeams: TeamStats[]
  leaderboard: {
    opr: TeamStats[]
    winRate: TeamStats[]
    avgScore: TeamStats[]
  }
  similarTeams: TeamStats[]
}

interface TeamComparisonProps {
  eventCode: string
  teamNumber: number
}

export function TeamComparison({ eventCode, teamNumber }: TeamComparisonProps) {
  const [data, setData] = useState<ComparisonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null)

  const fetchData = async () => {
    try {
      setError(null)
      setLoading(true)

      const response = await fetch(`/api/events/${eventCode}/team-comparison?team=${teamNumber}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch comparison data: ${response.status}`)
      }

      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error("Error fetching team comparison:", error)
      setError("Failed to load team comparison data. Please try again.")
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

  const getPerformanceIcon = (percentile: number) => {
    if (percentile >= 75) return <TrendingUp className="h-4 w-4" />
    if (percentile >= 25) return <Minus className="h-4 w-4" />
    return <TrendingDown className="h-4 w-4" />
  }

  const StatComparison = ({
    label,
    currentValue,
    compareValue,
    format = "number",
    higherIsBetter = true,
  }: {
    label: string
    currentValue: number
    compareValue: number
    format?: "number" | "percentage" | "decimal"
    higherIsBetter?: boolean
  }) => {
    const formatValue = (value: number) => {
      switch (format) {
        case "percentage":
          return `${value.toFixed(1)}%`
        case "decimal":
          return value.toFixed(1)
        default:
          return value.toString()
      }
    }

    const difference = currentValue - compareValue
    const isPositive = higherIsBetter ? difference > 0 : difference < 0
    const isNeutral = Math.abs(difference) < 0.1

    return (
      <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="font-semibold">{formatValue(currentValue)}</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground">vs {formatValue(compareValue)}</div>
          <div
            className={`text-sm font-medium flex items-center gap-1 ${
              isNeutral ? "text-gray-500" : isPositive ? "text-green-600" : "text-red-600"
            }`}
          >
            {!isNeutral && (isPositive ? "+" : "")}
            {formatValue(difference)}
            {!isNeutral && (isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />)}
          </div>
        </div>
      </div>
    )
  }

  const TeamCard = ({
    team,
    isSelected = false,
    onClick,
  }: {
    team: TeamStats
    isSelected?: boolean
    onClick?: () => void
  }) => (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="font-bold text-lg">Team {team.teamNumber}</div>
            <div className="text-sm text-muted-foreground">{team.rank ? `Rank #${team.rank}` : "Unranked"}</div>
          </div>
          <Badge variant={team.category === "Elite" ? "default" : team.category === "Strong" ? "secondary" : "outline"}>
            {team.category}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Record</div>
            <div className="font-semibold">
              {team.wins}-{team.losses}-{team.ties}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Win Rate</div>
            <div className="font-semibold">{team.winRate.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-muted-foreground">OPR</div>
            <div className="font-semibold">{team.opr.toFixed(1)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Avg Score</div>
            <div className="font-semibold">{team.avgScore.toFixed(1)}</div>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Performance Percentile</span>
            <span>{team.percentile.toFixed(0)}%</span>
          </div>
          <Progress value={team.percentile} className="h-2" />
        </div>
      </CardContent>
    </Card>
  )

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>Loading team comparison...</p>
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
              <p className="text-red-600 mb-4">{error || "Failed to load comparison data"}</p>
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

  const filteredTeams = data.allTeams
    .filter((team) => team.teamNumber.toString().includes(searchTerm) || team.teamNumber === teamNumber)
    .slice(0, 20)

  const compareTeam = selectedTeam ? data.allTeams.find((t) => t.teamNumber === selectedTeam) : null

  return (
    <div className="space-y-6">
      {/* Team Performance Overview */}
      {data.currentTeam ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Team {teamNumber} Performance Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {data.currentTeam.rank ? `#${data.currentTeam.rank}` : "NR"}
                </div>
                <div className="text-sm text-muted-foreground">Current Rank</div>
                <div className="text-xs text-muted-foreground mt-1">of {data.allTeams.length} teams</div>
              </div>

              <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <div
                  className={`text-2xl font-bold flex items-center justify-center gap-2 ${getPerformanceColor(
                    data.currentTeam.percentile,
                  )}`}
                >
                  {getPerformanceIcon(data.currentTeam.percentile)}
                  {data.currentTeam.percentile.toFixed(0)}%
                </div>
                <div className="text-sm text-muted-foreground">Percentile</div>
                <div className="text-xs text-muted-foreground mt-1">{data.currentTeam.category} Performer</div>
              </div>

              <div className="text-center p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{data.currentTeam.opr.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">OPR</div>
                <div className="text-xs text-muted-foreground mt-1">Offensive Power</div>
              </div>

              <div className="text-center p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{data.currentTeam.winRate.toFixed(1)}%</div>
                <div className="text-sm text-muted-foreground">Win Rate</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {data.currentTeam.wins}-{data.currentTeam.losses}-{data.currentTeam.ties}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-8 w-8 text-yellow-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Team {teamNumber} Not Found</h3>
            <p className="text-muted-foreground">
              Team {teamNumber} was not found in the rankings for this event. The team may not be participating or
              rankings may not be available yet.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Leaderboards */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Zap className="h-4 w-4" />
              Top OPR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.leaderboard.opr.slice(0, 5).map((team, index) => (
                <div
                  key={team.teamNumber}
                  className={`flex justify-between items-center p-2 rounded ${
                    team.teamNumber === teamNumber ? "bg-blue-100 dark:bg-blue-900" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={index < 3 ? "default" : "secondary"}>#{index + 1}</Badge>
                    <span className={team.teamNumber === teamNumber ? "font-bold" : ""}>{team.teamNumber}</span>
                  </div>
                  <span className="font-semibold">{team.opr.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="h-4 w-4" />
              Top Win Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.leaderboard.winRate.slice(0, 5).map((team, index) => (
                <div
                  key={team.teamNumber}
                  className={`flex justify-between items-center p-2 rounded ${
                    team.teamNumber === teamNumber ? "bg-blue-100 dark:bg-blue-900" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={index < 3 ? "default" : "secondary"}>#{index + 1}</Badge>
                    <span className={team.teamNumber === teamNumber ? "font-bold" : ""}>{team.teamNumber}</span>
                  </div>
                  <span className="font-semibold">{team.winRate.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-4 w-4" />
              Top Avg Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.leaderboard.avgScore.slice(0, 5).map((team, index) => (
                <div
                  key={team.teamNumber}
                  className={`flex justify-between items-center p-2 rounded ${
                    team.teamNumber === teamNumber ? "bg-blue-100 dark:bg-blue-900" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={index < 3 ? "default" : "secondary"}>#{index + 1}</Badge>
                    <span className={team.teamNumber === teamNumber ? "font-bold" : ""}>{team.teamNumber}</span>
                  </div>
                  <span className="font-semibold">{team.avgScore.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Similar Teams */}
      {data.similarTeams.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Similar Performance Teams
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.similarTeams.slice(0, 6).map((team) => (
                <TeamCard key={team.teamNumber} team={team} onClick={() => setSelectedTeam(team.teamNumber)} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Search and Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Compare with Other Teams
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search team number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {filteredTeams.map((team) => (
                <TeamCard
                  key={team.teamNumber}
                  team={team}
                  isSelected={selectedTeam === team.teamNumber}
                  onClick={() => setSelectedTeam(selectedTeam === team.teamNumber ? null : team.teamNumber)}
                />
              ))}
            </div>

            {/* Direct Comparison */}
            {compareTeam && data.currentTeam && (
              <div className="mt-6 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  Team {teamNumber} vs Team {compareTeam.teamNumber}
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <StatComparison
                    label="OPR"
                    currentValue={data.currentTeam.opr}
                    compareValue={compareTeam.opr}
                    format="decimal"
                  />
                  <StatComparison
                    label="Win Rate"
                    currentValue={data.currentTeam.winRate}
                    compareValue={compareTeam.winRate}
                    format="percentage"
                  />
                  <StatComparison
                    label="Average Score"
                    currentValue={data.currentTeam.avgScore}
                    compareValue={compareTeam.avgScore}
                    format="decimal"
                  />
                  <StatComparison
                    label="Ranking"
                    currentValue={data.currentTeam.rank || 999}
                    compareValue={compareTeam.rank || 999}
                    higherIsBetter={false}
                  />
                </div>
              </div>
            )}
            {compareTeam && !data.currentTeam && (
              <div className="mt-6 p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900">
                <p className="text-center text-muted-foreground">
                  Cannot compare - Team {teamNumber} data not available
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
