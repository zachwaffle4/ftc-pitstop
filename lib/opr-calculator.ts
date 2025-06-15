/**
 * OPR (Offensive Power Rating) Calculator
 * Based on The Blue Alliance's mathematical approach
 * https://blog.thebluealliance.com/2017/10/05/the-math-behind-opr-an-introduction/
 *
 * IMPORTANT: Only uses qualification matches and non-penalty scores
 */

interface Match {
  matchNumber: number
  red1: number
  red2: number
  blue1: number
  blue2: number
  redScore: number
  blueScore: number
  redScoreNoFoul: number // Non-penalty score
  blueScoreNoFoul: number // Non-penalty score
  played: boolean
  tournamentLevel: string
}

interface TeamOPR {
  teamNumber: number
  opr: number
  dpr: number
  ccwm: number
  matchesPlayed: number
}

export class OPRCalculator {
  private teams: Set<number> = new Set()
  private qualificationMatches: Match[] = []

  constructor(matches: Match[]) {
    // Filter to only qualification matches with valid non-penalty scores
    this.qualificationMatches = matches.filter(
      (m) =>
        m.played &&
        m.redScoreNoFoul !== null &&
        m.blueScoreNoFoul !== null &&
        (m.tournamentLevel === "Qualification" || m.tournamentLevel?.toLowerCase().includes("qual")),
    )

    console.log(`Filtered to ${this.qualificationMatches.length} qualification matches for OPR calculation`)

    // Collect all unique team numbers from qualification matches only
    this.qualificationMatches.forEach((match) => {
      this.teams.add(match.red1)
      this.teams.add(match.red2)
      this.teams.add(match.blue1)
      this.teams.add(match.blue2)
    })
  }

  /**
   * Calculate OPR using matrix algebra on qualification matches only
   * Uses non-penalty scores for accurate offensive contribution
   */
  calculateOPR(): TeamOPR[] {
    const teamList = Array.from(this.teams).sort((a, b) => a - b)
    const numTeams = teamList.length
    const numMatches = this.qualificationMatches.length

    if (numMatches === 0 || numTeams === 0) {
      console.log("No valid qualification matches found for OPR calculation")
      return []
    }

    console.log(`Calculating OPR for ${numTeams} teams using ${numMatches} qualification matches`)

    // Create team index mapping
    const teamToIndex = new Map<number, number>()
    teamList.forEach((team, index) => {
      teamToIndex.set(team, index)
    })

    // Build the coefficient matrix A (team participation matrix)
    // Each row represents an alliance in a match
    // Each column represents a team
    const A: number[][] = []
    const scores: number[] = []

    this.qualificationMatches.forEach((match) => {
      // Red alliance row - use non-penalty score
      const redRow = new Array(numTeams).fill(0)
      redRow[teamToIndex.get(match.red1)!] = 1
      redRow[teamToIndex.get(match.red2)!] = 1
      A.push(redRow)
      scores.push(match.redScoreNoFoul)

      // Blue alliance row - use non-penalty score
      const blueRow = new Array(numTeams).fill(0)
      blueRow[teamToIndex.get(match.blue1)!] = 1
      blueRow[teamToIndex.get(match.blue2)!] = 1
      A.push(blueRow)
      scores.push(match.blueScoreNoFoul)
    })

    // Solve using least squares: (A^T * A) * x = A^T * b
    const AtA = this.multiplyMatrices(this.transpose(A), A)
    const Atb = this.multiplyMatrixVector(this.transpose(A), scores)

    // Solve the system using Gaussian elimination
    const oprValues = this.solveLinearSystem(AtA, Atb)

    // Calculate DPR (Defensive Power Rating) - properly this time
    const dprValues = this.calculateDPR(teamList, teamToIndex, oprValues)

    // Calculate CCWM (Calculated Contribution to Winning Margin)
    const ccwmValues = oprValues.map((opr, i) => opr - dprValues[i])

    // Count qualification matches played for each team
    const matchCounts = this.countMatchesPlayed(teamList, teamToIndex)

    // Build result array
    const results = teamList.map((teamNumber, index) => ({
      teamNumber,
      opr: oprValues[index] || 0,
      dpr: dprValues[index] || 0,
      ccwm: ccwmValues[index] || 0,
      matchesPlayed: matchCounts[index] || 0,
    }))

    console.log(`Successfully calculated OPR for ${results.length} teams`)
    return results
  }

  /**
   * Calculate DPR (Defensive Power Rating) properly
   * DPR represents how many points a team's defense prevents opponents from scoring
   * This is calculated by looking at how opponents perform against this team vs their average
   */
  private calculateDPR(teamList: number[], teamToIndex: Map<number, number>, oprValues: number[]): number[] {
    const numTeams = teamList.length
    const dprValues = new Array(numTeams).fill(0)

    // For each team, calculate their defensive impact
    teamList.forEach((teamNumber, teamIndex) => {
      let totalDefensiveImpact = 0
      let defensiveOpportunities = 0

      this.qualificationMatches.forEach((match) => {
        let isDefending = false
        let opponentScore = 0
        let opponentOPRSum = 0

        // Check if this team is on red alliance (defending against blue)
        if (match.red1 === teamNumber || match.red2 === teamNumber) {
          isDefending = true
          opponentScore = match.blueScoreNoFoul
          // Get OPR of blue alliance teams
          const blue1Index = teamToIndex.get(match.blue1)
          const blue2Index = teamToIndex.get(match.blue2)
          if (blue1Index !== undefined && blue2Index !== undefined) {
            opponentOPRSum = oprValues[blue1Index] + oprValues[blue2Index]
          }
        }
        // Check if this team is on blue alliance (defending against red)
        else if (match.blue1 === teamNumber || match.blue2 === teamNumber) {
          isDefending = true
          opponentScore = match.redScoreNoFoul
          // Get OPR of red alliance teams
          const red1Index = teamToIndex.get(match.red1)
          const red2Index = teamToIndex.get(match.red2)
          if (red1Index !== undefined && red2Index !== undefined) {
            opponentOPRSum = oprValues[red1Index] + oprValues[red2Index]
          }
        }

        if (isDefending && opponentOPRSum > 0) {
          // Defensive impact = Expected opponent score - Actual opponent score
          // Positive DPR means good defense (prevented points)
          const expectedOpponentScore = opponentOPRSum
          const defensiveImpact = expectedOpponentScore - opponentScore
          totalDefensiveImpact += defensiveImpact
          defensiveOpportunities++
        }
      })

      if (defensiveOpportunities > 0) {
        dprValues[teamIndex] = totalDefensiveImpact / defensiveOpportunities
      }
    })

    return dprValues
  }

  /**
   * Count qualification matches played for each team
   */
  private countMatchesPlayed(teamList: number[], teamToIndex: Map<number, number>): number[] {
    const counts = new Array(teamList.length).fill(0)

    this.qualificationMatches.forEach((match) => {
      counts[teamToIndex.get(match.red1)!]++
      counts[teamToIndex.get(match.red2)!]++
      counts[teamToIndex.get(match.blue1)!]++
      counts[teamToIndex.get(match.blue2)!]++
    })

    return counts
  }

  /**
   * Matrix transpose
   */
  private transpose(matrix: number[][]): number[][] {
    if (matrix.length === 0) return []
    const rows = matrix.length
    const cols = matrix[0].length
    const result: number[][] = []

    for (let j = 0; j < cols; j++) {
      result[j] = []
      for (let i = 0; i < rows; i++) {
        result[j][i] = matrix[i][j]
      }
    }

    return result
  }

  /**
   * Matrix multiplication
   */
  private multiplyMatrices(a: number[][], b: number[][]): number[][] {
    const aRows = a.length
    const aCols = a[0].length
    const bCols = b[0].length
    const result: number[][] = []

    for (let i = 0; i < aRows; i++) {
      result[i] = []
      for (let j = 0; j < bCols; j++) {
        let sum = 0
        for (let k = 0; k < aCols; k++) {
          sum += a[i][k] * b[k][j]
        }
        result[i][j] = sum
      }
    }

    return result
  }

  /**
   * Matrix-vector multiplication
   */
  private multiplyMatrixVector(matrix: number[][], vector: number[]): number[] {
    const result: number[] = []

    for (let i = 0; i < matrix.length; i++) {
      let sum = 0
      for (let j = 0; j < vector.length; j++) {
        sum += matrix[i][j] * vector[j]
      }
      result[i] = sum
    }

    return result
  }

  /**
   * Solve linear system Ax = b using Gaussian elimination with partial pivoting
   */
  private solveLinearSystem(A: number[][], b: number[]): number[] {
    const n = A.length
    const augmented: number[][] = []

    // Create augmented matrix [A|b]
    for (let i = 0; i < n; i++) {
      augmented[i] = [...A[i], b[i]]
    }

    // Forward elimination with partial pivoting
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

      // Make all rows below this one 0 in current column
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[i][i]) < 1e-10) continue // Skip if pivot is too small

        const factor = augmented[k][i] / augmented[i][i]
        for (let j = i; j <= n; j++) {
          augmented[k][j] -= factor * augmented[i][j]
        }
      }
    }

    // Back substitution
    const x: number[] = new Array(n).fill(0)
    for (let i = n - 1; i >= 0; i--) {
      x[i] = augmented[i][n]
      for (let j = i + 1; j < n; j++) {
        x[i] -= augmented[i][j] * x[j]
      }
      if (Math.abs(augmented[i][i]) > 1e-10) {
        x[i] /= augmented[i][i]
      }
    }

    return x
  }
}

/**
 * Utility function to calculate OPR for a set of matches
 */
export function calculateOPRForMatches(matches: Match[]): TeamOPR[] {
  const calculator = new OPRCalculator(matches)
  return calculator.calculateOPR()
}

/**
 * Get OPR data for a specific team
 */
export function getTeamOPR(teamNumber: number, oprData: TeamOPR[]): TeamOPR | null {
  return oprData.find((team) => team.teamNumber === teamNumber) || null
}

/**
 * Sort teams by OPR (highest first)
 */
export function sortTeamsByOPR(oprData: TeamOPR[]): TeamOPR[] {
  return [...oprData].sort((a, b) => b.opr - a.opr)
}

/**
 * Sort teams by DPR (highest first, since higher DPR is better defense)
 */
export function sortTeamsByDPR(oprData: TeamOPR[]): TeamOPR[] {
  return [...oprData].sort((a, b) => b.dpr - a.dpr)
}

/**
 * Sort teams by CCWM (highest first)
 */
export function sortTeamsByCCWM(oprData: TeamOPR[]): TeamOPR[] {
  return [...oprData].sort((a, b) => b.ccwm - a.ccwm)
}
