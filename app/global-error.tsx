"use client"

import { Button } from "@/components/ui/button"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
          <div className="w-full max-w-md rounded-lg border border-red-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-red-600">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <h1 className="text-xl font-semibold">Application Error</h1>
            </div>
            <p className="mt-2 text-gray-600">
              A critical error occurred in the application. Please try again or contact support if the problem persists.
            </p>
            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={() => (window.location.href = "/")}>
                Go Home
              </Button>
              <Button onClick={() => reset()}>Try Again</Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
