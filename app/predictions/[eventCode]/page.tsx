"use client"

import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { MatchPredictions } from "@/components/match-predictions"

export default function PredictionsPage() {
  const params = useParams()
  const eventCode = params.eventCode as string

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href={`/event/${eventCode}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Event
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Match Predictions</h1>
            <p className="text-muted-foreground">Event: {eventCode}</p>
          </div>
        </div>

        <MatchPredictions eventCode={eventCode} />
      </div>
    </div>
  )
}
