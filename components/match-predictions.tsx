"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { TrendingUp, Target, Zap, Clock, AlertTriangle, Trophy, RefreshCw, Info } from "lucide-react"

interface MatchPrediction {
  matchNumber: number
  description: string
  startTime?: string
  red1: number
  red2: number
  blue1: number
  blue2: number
  predictedRedScore: number
  predictedBlueScore: number
  redWinProbability: number
  blueWinProbability: number
  confidence: "low" | "medium" | "high"
  tournamentLevel: string
}

interface MatchPredictionsProps {
  eventCode: string
  teamNumber?: number
}

export function MatchPredictions({ eventCode, teamNumber }: MatchPredictionsProps) {
  const [predictions, setPredictions] = useState<MatchPrediction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchPredictions = async () => {
    try {
      setError(null)
      console.log("Fetching match predictions for event:", eventCode)

      const url = teamNumber
        ? `/api/events/${eventCode}/predictions?team=${teamNumber}`
        : `/api/events/${eventCode}/predictions`

      const response = await fetch(url)
      const data = await response.json()

      if (response.ok) {
        setPredictions(data.predictions || [])
        setLastUpdate(new Date())
        console.log(`Loaded ${data.predictions?.length || 0} predictions`)
      } else {
        setError("Unable to load match predictions")
      }
    } catch (error) {
      console.error("Error fetching predictions:", error)
      setError("Failed to load predictions")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPredictions()

    // Refresh predictions every 2 minutes
    const interval = setInterval(fetchPredictions, 120000)
    return () => clearInterval(interval)
  }, [eventCode, teamNumber])

  // Separate predictions by tournament level
  const qualificationPredictions = predictions.filter(
    (p) => p.tournamentLevel === "Qualification" || p.description.toLowerCase().includes("qual"),
  )
  const playoffPredictions = predictions.filter(
    (p) => p.tournamentLevel !== "Qualification" && !p.description.toLowerCase().includes("qual"),
  )

  // Filter team-specific predictions
  const teamPredictions = teamNumber
    ? predictions.filter(
        (p) => p.red1 === teamNumber || p.red2 === teamNumber || p.blue1 === teamNumber || p.blue2 === teamNumber,
      )
    : []

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "high":
        return "text-green-600"
      case "medium":
        return "text-yellow-600"
      case "low":
        return "text-red-600"
      default:
        return "text-gray-600"
    }
  }

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case "high":
        return "default"
      case "medium":
        return "secondary"
      case "low":
        return "outline"
      default:
        return "outline"
    }
  }

  const PredictionCard = ({
    prediction,
    highlightTeam = false,
  }: {
    prediction: MatchPrediction
    highlightTeam?: boolean
  }) => {
    const isTeamRed = teamNumber && (prediction.red1 === teamNumber || prediction.red2 === teamNumber)
    const isTeamBlue = teamNumber && (prediction.blue1 === teamNumber || prediction.blue2 === teamNumber)
    const teamWinProb = isTeamRed ? prediction.redWinProbability : isTeamBlue ? prediction.blueWinProbability : 0

    return (
      <Card className={highlightTeam && (isTeamRed || isTeamBlue) ? "border-blue-300 bg-blue-50 dark:bg-blue-950" : ""}>
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="font-semibold">{prediction.description}</div>
              {prediction.startTime && (
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(prediction.startTime).toLocaleTimeString()}
                </div>
              )}
            </div>
            <div className="text-right">
              <Badge variant="outline">Match {prediction.matchNumber}</Badge>
              <Badge
                variant={getConfidenceBadge(prediction.confidence)}
                className={`ml-2 ${getConfidenceColor(prediction.confidence)}`}
              >
                {prediction.confidence.toUpperCase()}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Red Alliance */}
            <div
              className={`p-3 rounded-lg ${
                isTeamRed ? "bg-red-100 dark:bg-red-900 border-2 border-red-300" : "bg-red-50 dark:bg-red-950"
              }`}
            >
              <div className="text-center">
                <div className="text-sm font-semibold text-red-700 dark:text-red-300 mb-2">Red Alliance</div>
                <div className="space-y-1 mb-3">
                  <div className={`font-semibold ${prediction.red1 === teamNumber ? "text-blue-600 font-bold" : ""}`}>
                    {prediction.red1}
                  </div>
                  <div className={`font-semibold ${prediction.red2 === teamNumber ? "text-blue-600 font-bold" : ""}`}>
                    {prediction.red2}
                  </div>
                </div>
                <div className="text-2xl font-bold text-red-700 dark:text-red-300 mb-2">
                  {prediction.predictedRedScore}
                </div>
                <div className="text-sm font-semibold">{prediction.redWinProbability}% win</div>
                <Progress value={prediction.redWinProbability} className="h-2 mt-1" />
              </div>
            </div>

            {/* Blue Alliance */}
            <div
              className={`p-3 rounded-lg ${
                isTeamBlue ? "bg-blue-100 dark:bg-blue-900 border-2 border-blue-300" : "bg-blue-50 dark:bg-blue-950"
              }`}
            >
              <div className="text-center">
                <div className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2">Blue Alliance</div>
                <div className="space-y-1 mb-3">
                  <div className={`font-semibold ${prediction.blue1 === teamNumber ? "text-red-600 font-bold" : ""}`}>
                    {prediction.blue1}
                  </div>
                  <div className={`font-semibold ${prediction.blue2 === teamNumber ? "text-red-600 font-bold" : ""}`}>
                    {prediction.blue2}
                  </div>
                </div>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300 mb-2">
                  {prediction.predictedBlueScore}
                </div>
                <div className="text-sm font-semibold">{prediction.blueWinProbability}% win</div>
                <Progress value={prediction.blueWinProbability} className="h-2 mt-1" />
              </div>
            </div>
          </div>

          {/* Team-specific win probability highlight */}
          {highlightTeam && (isTeamRed || isTeamBlue) && (
            <div
              className={`text-center p-2 rounded-lg ${
                teamWinProb >= 70
                  ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                  : teamWinProb >= 50
                    ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200"
                    : "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
              }`}
            >
              <div className="font-semibold">Your Team: {teamWinProb}% chance to win</div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p>Calculating match predictions...</p>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-yellow-600 mx-auto mb-4" />
          <p className="text-yellow-900 dark:text-yellow-100">{error}</p>
          <Button variant="outline" onClick={fetchPredictions} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (predictions.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Predictions Available</h3>
          <p className="text-muted-foreground">
            Match predictions will appear here once OPR data is available and there are upcoming matches.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            Match Predictions
          </h2>
          <p className="text-muted-foreground">AI-powered predictions based on OPR/DPR statistics</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchPredictions}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <p className="text-xs text-muted-foreground">Updated: {lastUpdate.toLocaleTimeString()}</p>
        </div>
      </div>

      {/* Prediction Info */}
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-semibold mb-1">How Predictions Work:</p>
              <p>
                Predictions use OPR (Offensive Power Rating) and DPR (Defensive Power Rating) to estimate match
                outcomes. Higher confidence indicates more match data is available for accurate predictions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue={teamNumber ? "your-team" : "qualification"} className="space-y-4">
        <TabsList className={`grid w-full ${teamNumber ? "grid-cols-3" : "grid-cols-2"}`}>
          {teamNumber && (
            <TabsTrigger value="your-team" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Your Matches ({teamPredictions.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="qualification" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Qualification ({qualificationPredictions.length})
          </TabsTrigger>
          <TabsTrigger value="playoffs" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Playoffs ({playoffPredictions.length})
          </TabsTrigger>
        </TabsList>

        {teamNumber && (
          <TabsContent value="your-team" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Your Upcoming Matches
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {teamPredictions.slice(0, 10).map((prediction) => (
                    <PredictionCard key={prediction.matchNumber} prediction={prediction} highlightTeam={true} />
                  ))}
                  {teamPredictions.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">
                      No upcoming matches with predictions available
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="qualification" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Qualification Match Predictions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {qualificationPredictions.slice(0, 20).map((prediction) => (
                  <PredictionCard key={prediction.matchNumber} prediction={prediction} highlightTeam={!!teamNumber} />
                ))}
                {qualificationPredictions.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No qualification match predictions available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="playoffs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Playoff Match Predictions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {playoffPredictions.map((prediction) => (
                  <PredictionCard key={prediction.matchNumber} prediction={prediction} highlightTeam={!!teamNumber} />
                ))}
                {playoffPredictions.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    Playoff predictions will appear here after alliance selection
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
