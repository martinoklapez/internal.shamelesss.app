import { cn } from '@/lib/utils'

function Pulse({ className }: { className?: string }) {
  return <div className={cn('rounded-md bg-gray-200/90 animate-pulse', className)} />
}

export function CreatorOutreachLoading({
  variant = 'pipeline',
}: {
  variant?: 'pipeline' | 'log' | 'templates'
}) {
  if (variant === 'log') {
    return (
      <div
        className="flex-1 min-h-0 min-w-0 overflow-hidden px-5 sm:px-8 lg:px-10 py-8 animate-pulse"
        aria-busy
        aria-label="Loading log"
      >
        <Pulse className="h-3 w-20 mb-6" />
        <Pulse className="h-6 w-16 mb-2" />
        <Pulse className="h-3 w-56 mb-8" />
        <div className="space-y-8">
          {[0, 1].map((section) => (
            <div key={section}>
              <Pulse className="h-3 w-24 mb-3" />
              <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                {[0, 1, 2, 3, 4, 5].map((row) => (
                  <div key={row} className="flex gap-3 py-3 px-3">
                    <Pulse className="h-4 flex-1 max-w-xs" />
                    <Pulse className="h-4 w-24 shrink-0" />
                    <Pulse className="h-4 w-16 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (variant === 'templates') {
    return (
      <div
        className="flex-1 min-h-0 min-w-0 overflow-hidden px-5 sm:px-8 lg:px-10 py-8 animate-pulse"
        aria-busy
        aria-label="Loading templates"
      >
        <Pulse className="h-3 w-20 mb-6" />
        <Pulse className="h-6 w-28 mb-2" />
        <Pulse className="h-3 w-72 mb-8" />
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
          {[0, 1, 2].map((row) => (
            <div key={row} className="py-4 px-4 space-y-2">
              <Pulse className="h-4 w-40" />
              <Pulse className="h-3 w-56" />
              <Pulse className="h-12 w-full max-w-lg" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex h-full min-h-0 flex-1 w-full flex-col overflow-hidden px-5 sm:px-8 lg:px-10 py-8 animate-pulse"
      aria-busy
      aria-label="Loading pipeline"
    >
      <Pulse className="h-6 w-28 mb-2" />
      <Pulse className="h-3 w-full max-w-md mb-6" />
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 pb-3 mb-4">
        <div className="flex gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Pulse key={i} className="h-4 w-14" />
          ))}
        </div>
        <Pulse className="h-7 w-[7.5rem]" />
        <Pulse className="h-8 flex-1 max-w-md" />
        <Pulse className="h-8 w-16 ml-auto" />
      </div>
      <div className="flex flex-1 min-h-0 gap-3">
        {[0, 1, 2, 3].map((col) => (
          <div
            key={col}
            className="flex min-w-0 flex-1 flex-col rounded-lg border border-gray-100 bg-gray-50/50"
          >
            <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5">
              <Pulse className="h-5 w-20" />
              <Pulse className="h-3 w-6 ml-auto" />
            </div>
            <div className="space-y-2 p-2">
              {[0, 1, 2].map((card) => (
                <div
                  key={card}
                  className="rounded-md border border-gray-100 bg-white p-2.5 space-y-2"
                >
                  <div className="flex gap-2">
                    <Pulse className="h-7 w-7 shrink-0 rounded-full" />
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <Pulse className="h-3.5 w-3/4" />
                      <Pulse className="h-3 w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
