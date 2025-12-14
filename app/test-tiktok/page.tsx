'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function TestTikTokPage() {
  const [handle, setHandle] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const testHandle = async () => {
    if (!handle.trim()) {
      setError('Please enter a TikTok handle')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(`/api/test/tiktok?handle=${encodeURIComponent(handle)}`)
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to fetch account name')
        setResult(data)
      } else {
        setResult(data)
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Test TikTok Account Name Fetch
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Enter a TikTok handle to fetch the account name
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="handle">TikTok Handle</Label>
            <Input
              id="handle"
              type="text"
              placeholder="@username or username"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  testHandle()
                }
              }}
            />
            <p className="text-sm text-gray-500">
              Format: tiktok.com/@<span className="font-mono">handle</span>
            </p>
          </div>

          <Button onClick={testHandle} disabled={loading}>
            {loading ? 'Fetching...' : 'Test Handle'}
          </Button>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 font-medium">Error</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          )}

          {result && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
              <p className="text-sm font-medium text-gray-900">Result</p>
              
              {result.accountName ? (
                <div className="space-y-1">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">Account Name:</span> {result.accountName}
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">Handle:</span> @{result.handle}
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">URL:</span>{' '}
                    <a 
                      href={result.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {result.url}
                    </a>
                  </p>
                  {result.method && (
                    <p className="text-sm text-gray-500">
                      <span className="font-semibold">Method:</span> {result.method}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-red-600">
                    Could not extract account name from the profile page.
                  </p>
                  {result.error && (
                    <p className="text-sm text-gray-600">{result.error}</p>
                  )}
                  {result.htmlSnippet && (
                    <details className="mt-2">
                      <summary className="text-sm text-gray-600 cursor-pointer">
                        View HTML snippet (for debugging)
                      </summary>
                      <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-96">
                        {result.htmlSnippet}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

