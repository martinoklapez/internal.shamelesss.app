export default function DeviceDetailLoading() {
  return (
    <div className="min-h-screen animate-pulse bg-white">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-md border border-gray-200 bg-gray-100" />
            <div className="space-y-2">
              <div className="h-8 w-40 rounded bg-gray-200" />
              <div className="h-4 w-28 rounded bg-gray-100" />
            </div>
          </div>
          <div className="h-8 w-32 rounded-full bg-gray-100" />
        </div>
        <div className="space-y-4">
          <div className="h-48 rounded-lg border border-gray-200 bg-gray-50" />
          <div className="h-48 rounded-lg border border-gray-200 bg-gray-50" />
          <div className="h-48 rounded-lg border border-gray-200 bg-gray-50" />
        </div>
      </div>
    </div>
  )
}
