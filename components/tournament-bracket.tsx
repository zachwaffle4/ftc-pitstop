"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, Crown } from "lucide-react"

interface Match {
  matchNumber: number
  description: string
  startTime: string
  red1: number
  red2: number
  blue1: number
  blue2: number
  redScore: number
  blueScore: number
  played: boolean
  tournamentLevel: string
  series?: number
  matchInSeries?: number
}

interface Alliance {
  number: number
  captain: number
  round1: number
  round2: number
  backup?: number
  name?: string
}

interface TournamentBracketProps {
  matches: Match[]
  alliances: Alliance[]
  teamNumber: number
}

interface BracketMatch {
  id: string
  round: string
  series: number
  matchInSeries: number
  alliance1: number
  alliance2: number
  score1?: number
  score2?: number
  winner?: number
  played: boolean
  teams1: number[]
  teams2: number[]
}

export function TournamentBracket({ matches, alliances, teamNumber }: TournamentBracketProps) {
  // Transform playoff matches into bracket format
  const playoffMatches = matches.filter(
    (m) => m.tournamentLevel !== "Qualification" && !m.description.toLowerCase().includes("qual"),
  )

  // Group matches by series and round
  const bracketMatches: BracketMatch[] = []

  playoffMatches.forEach((match) => {
    // Try to determine alliance numbers from team numbers
    const redAlliance = alliances.find(
      (a) =>
        a.captain === match.red1 ||
        a.round1 === match.red1 ||
        a.round2 === match.red1 ||
        a.captain === match.red2 ||
        a.round1 === match.red2 ||
        a.round2 === match.red2,
    )
    const blueAlliance = alliances.find(
      (a) =>
        a.captain === match.blue1 ||
        a.round1 === match.blue1 ||
        a.round2 === match.blue1 ||
        a.captain === match.blue2 ||
        a.round1 === match.blue2 ||
        a.round2 === match.blue2,
    )

    if (redAlliance && blueAlliance) {
      const winner = match.played
        ? match.redScore > match.blueScore
          ? redAlliance.number
          : match.blueScore > match.redScore
            ? blueAlliance.number
            : undefined
        : undefined

      bracketMatches.push({
        id: `${match.series || 1}-${match.matchInSeries || 1}`,
        round: match.description.includes("Final")
          ? "Finals"
          : match.description.includes("Semi")
            ? "Semifinals"
            : "Quarterfinals",
        series: match.series || 1,
        matchInSeries: match.matchInSeries || 1,
        alliance1: redAlliance.number,
        alliance2: blueAlliance.number,
        score1: match.played ? match.redScore : undefined,
        score2: match.played ? match.blueScore : undefined,
        winner,
        played: match.played,
        teams1: [redAlliance.captain, redAlliance.round1, redAlliance.round2].filter(Boolean),
        teams2: [blueAlliance.captain, blueAlliance.round1, blueAlliance.round2].filter(Boolean),
      })
    }
  })

  // Group by round
  const rounds = {
    Quarterfinals: bracketMatches.filter((m) => m.round === "Quarterfinals"),
    Semifinals: bracketMatches.filter((m) => m.round === "Semifinals"),
    Finals: bracketMatches.filter((m) => m.round === "Finals"),
  }

  const isTeamInAlliance = (teams: number[]) => teams.includes(teamNumber)

  const AllianceDisplay = ({
    allianceNumber,
    teams,
    score,
    isWinner,
    isHighlighted,
  }: {
    allianceNumber: number
    teams: number[]
    score?: number
    isWinner?: boolean
    isHighlighted?: boolean
  }) => (
    <div
      className={`p-3 rounded-lg border-2 transition-all ${
        isHighlighted
          ? "border-blue-400 bg-blue-50 dark:bg-blue-950"
          : isWinner
            ? "border-green-400 bg-green-50 dark:bg-green-950"
            : "border-gray-200 bg-gray-50 dark:bg-gray-800"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <Badge variant={isWinner ? "default" : "outline"} className="text-xs">
          Alliance {allianceNumber}
          {isWinner && <Crown className="h-3 w-3 ml-1" />}
        </Badge>
        {score !== undefined && (
          <span className={`font-bold text-lg ${isWinner ? "text-green-600" : "text-gray-600"}`}>{score}</span>
        )}
      </div>
      <div className="space-y-1">
        {teams.map((team, index) => (
          <div
            key={team}
            className={`text-sm ${
              team === teamNumber ? "font-bold text-blue-600" : "text-gray-700 dark:text-gray-300"
            }`}
          >
            {index === 0 ? "🏆" : index === 1 ? "1️⃣" : "2️⃣"} {team}
          </div>
        ))}
      </div>
    </div>
  )

  const BracketMatchCard = ({ match }: { match: BracketMatch }) => {
    const isTeamInvolved = isTeamInAlliance(match.teams1) || isTeamInAlliance(match.teams2)
    const alliance1Highlighted = isTeamInAlliance(match.teams1)
    const alliance2Highlighted = isTeamInAlliance(match.teams2)

    return (
      <Card className={`${isTeamInvolved ? "ring-2 ring-blue-400" : ""}`}>
        <CardContent className="p-4">
          <div className="text-center mb-3">
            <Badge variant="secondary" className="text-xs">
              {match.round} - Series {match.series}
            </Badge>
          </div>

          <div className="space-y-3">
            <AllianceDisplay
              allianceNumber={match.alliance1}
              teams={match.teams1}
              score={match.score1}
              isWinner={match.winner === match.alliance1}
              isHighlighted={alliance1Highlighted}
            />

            <div className="text-center text-xs text-muted-foreground font-semibold">VS</div>

            <AllianceDisplay
              allianceNumber={match.alliance2}
              teams={match.teams2}
              score={match.score2}
              isWinner={match.winner === match.alliance2}
              isHighlighted={alliance2Highlighted}
            />
          </div>

          {!match.played && (
            <div className="text-center mt-2">
              <Badge variant="outline" className="text-xs">
                Not Played
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (bracketMatches.length === 0) {
    return (
      <div className="text-center py-12">
        <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Tournament Bracket</h3>
        <p className="text-muted-foreground">
          The elimination bracket will appear here after alliance selection and playoff matches begin.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold flex items-center justify-center gap-2 mb-2">
          <Trophy className="h-6 w-6" />
          Tournament Bracket
        </h2>
        <p className="text-muted-foreground">Elimination Tournament Progress</p>
      </div>

      {/* Desktop Bracket Layout */}
      <div className="hidden lg:block">
        <div className="grid grid-cols-3 gap-8 items-center">
          {/* Quarterfinals */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-center">Quarterfinals</h3>
            {rounds.Quarterfinals.map((match) => (
              <BracketMatchCard key={match.id} match={match} />
            ))}
          </div>

          {/* Semifinals */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-center">Semifinals</h3>
            {rounds.Semifinals.map((match) => (
              <BracketMatchCard key={match.id} match={match} />
            ))}
          </div>

          {/* Finals */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-center">Finals</h3>
            {rounds.Finals.map((match) => (
              <BracketMatchCard key={match.id} match={match} />
            ))}
          </div>
        </div>
      </div>

      {/* Mobile/Tablet Stacked Layout */}
      <div className="lg:hidden space-y-6">
        {Object.entries(rounds).map(
          ([roundName, roundMatches]) =>
            roundMatches.length > 0 && (
              <div key={roundName} className="space-y-4">
                <h3 className="text-lg font-semibold text-center">{roundName}</h3>
                <div className="grid gap-4">
                  {roundMatches.map((match) => (
                    <BracketMatchCard key={match.id} match={match} />
                  ))}
                </div>
              </div>
            ),
        )}
      </div>

      {/* Legend */}
      <div className="bg-muted/50 rounded-lg p-4">
        <h4 className="font-semibold mb-2">Legend:</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-100 border-2 border-blue-400 rounded"></div>
            <span>Your Team</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 border-2 border-green-400 rounded"></div>
            <span>Winner</span>
          </div>
          <div className="flex items-center gap-2">
            <span>🏆</span>
            <span>Captain</span>
          </div>
          <div className="flex items-center gap-2">
            <span>1️⃣2️⃣</span>
            <span>Picks</span>
          </div>
        </div>
      </div>
    </div>
  )
}
