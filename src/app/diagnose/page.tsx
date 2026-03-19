'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface TestResult {
  status: number | string;
  data?: any;
  error?: string;
}

export default function DiagnosePage() {
  const router = useRouter()
  const [testId, setTestId] = useState('9aea08f5-9b6b-46e8-8e6d-b73587751512')
  const [results, setResults] = useState<Record<string, TestResult> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const runTest = async (testName: string, url: string) => {
    try {
      setLoading(true)
      setError('')
      
      const response = await fetch(url)
      const data = await response.json()
      
      setResults(prev => ({
        ...(prev || {}),
        [testName]: {
          status: response.status,
          data
        }
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run test')
      setResults(prev => ({
        ...(prev || {}),
        [testName]: {
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error'
        }
      }))
    } finally {
      setLoading(false)
    }
  }

  const runAllTests = async () => {
    setResults({})
    
    // Test 1: Verify policies
    await runTest('verifyPolicies', '/api/verify-policies')
    
    // Test 3: Verify specific file retrieval
    await runTest('verifyFileRetrieval', `/api/verify-file-retrieval?testId=${testId}`)
    
    // Test 4: Test file API directly
    await runTest('testFileApi', `/api/test-file/${testId}`)
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center py-8">
          <h1 className="text-3xl md:text-4xl font-bold text-teal-400">ShadeDrop Diagnostics</h1>
          <p className="text-gray-400 mt-2">Troubleshooting download issues</p>
        </header>

        <main className="bg-gray-800 rounded-xl p-6 md:p-8 shadow-lg">
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Test File ID</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={testId}
                onChange={(e) => setTestId(e.target.value)}
                className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Enter file ID to test"
              />
              <button
                onClick={runAllTests}
                disabled={loading}
                className="bg-teal-600 hover:bg-teal-500 px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {loading ? 'Testing...' : 'Run All Tests'}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-red-200 mb-6">
              {error}
            </div>
          )}

          {results && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Test Results</h2>
              
              {Object.entries(results).map(([testName, result]) => (
                <div key={testName} className="bg-gray-700 rounded-lg p-4">
                  <h3 className="font-medium text-lg mb-2 capitalize">
                    {testName.replace(/([A-Z])/g, ' $1').trim()}
                  </h3>
                  <div className="text-sm">
                    <p className="mb-2">
                      <span className="text-gray-400">Status:</span>{' '}
                      <span className={result.status === 200 || result.status === 'success' ? 'text-green-400' : 'text-red-400'}>
                        {result.status}
                      </span>
                    </p>
                    {result.data ? (
                      <pre className="bg-gray-800 p-3 rounded overflow-x-auto text-xs">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    ) : result.error ? (
                      <p className="text-red-400">{result.error}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-700">
            <h2 className="text-2xl font-bold mb-4">Troubleshooting Steps</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-300">
              <li>Run all tests above to identify the issue</li>
              <li>Check if files are being stored in the database correctly</li>
              <li>Ensure the file ID format is correct (UUID)</li>
              <li>Check browser console for JavaScript errors</li>
              <li>Verify Supabase environment variables are correctly set</li>
            </ol>
            
            <button
              onClick={() => router.push('/')}
              className="mt-6 bg-teal-600 hover:bg-teal-500 py-2 px-4 rounded-lg"
            >
              Back to Home
            </button>
          </div>
        </main>

        <footer className="text-center text-gray-500 text-sm mt-8">
          <p>ShadeDrop - Secure, anonymous file sharing</p>
        </footer>
      </div>
    </div>
  )
}