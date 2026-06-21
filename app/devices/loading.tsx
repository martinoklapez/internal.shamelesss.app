export default function DevicesLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl animate-pulse px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 h-8 w-48 rounded bg-gray-200" />
      <div className="mb-2 h-4 w-72 max-w-full rounded bg-gray-100" />
      <div className="mt-8 space-y-3">
        <div className="h-24 rounded-lg border border-gray-200 bg-gray-50" />
        <div className="h-24 rounded-lg border border-gray-200 bg-gray-50" />
        <div className="h-24 rounded-lg border border-gray-200 bg-gray-50" />
      </div>
    </div>
  )
}
