import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="min-h-screen flex">
      {/* Left Sidebar Navigation */}
      <div className="w-48 bg-white border-r">
        <div className="p-4 border-b">
          <Skeleton className="h-10 w-32" />
        </div>
        <nav className="py-6">
          <ul className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <li key={i}>
                <Skeleton className="h-8 w-40 mx-4" />
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <header className="bg-white border-b p-4 flex justify-between items-center">
          <div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <div className="flex items-center space-x-4">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-6 w-6 rounded-full" />
          </div>
        </header>

        {/* Account Settings Content */}
        <div className="flex-1 p-6 bg-gray-50">
          <div className="max-w-2xl mx-auto">
            <Skeleton className="h-64 w-full rounded-lg mb-6" />
            <Skeleton className="h-80 w-full rounded-lg" />
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-white border-t p-4">
          <Skeleton className="h-4 w-24" />
        </footer>
      </div>
    </div>
  )
}
