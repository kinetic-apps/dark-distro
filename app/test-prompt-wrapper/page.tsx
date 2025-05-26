'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

export default function TestPromptWrapperPage() {
  const [inputText, setInputText] = useState<string>('')
  const [results, setResults] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const testPromptWrapper = async () => {
    if (!inputText.trim()) return

    setIsLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/test/prompt-wrapper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: inputText })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to test prompt wrapper')
      }

      setResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-8">Prompt Wrapper Test</h1>
        
        <div className="space-y-6">
          {/* Input Section */}
          <div className="card-lg">
            <h2 className="text-lg font-medium mb-4">Test Input</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                  Enter text to test prompt wrapping
                </label>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-dark-500"
                  rows={3}
                  placeholder="New Product Launch"
                />
              </div>
              
              <button
                onClick={testPromptWrapper}
                disabled={isLoading || !inputText.trim()}
                className="btn-primary"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Test Prompt Wrapper'
                )}
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="card-lg bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
              <p className="text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Results */}
          {results && (
            <div className="space-y-4">
              <div className="card-lg">
                <h2 className="text-lg font-medium mb-4">Analysis</h2>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Input:</span> "{results.input}"</p>
                  <p><span className="font-medium">Detected as raw text:</span> {results.isRawTextInput ? 'Yes' : 'No'}</p>
                </div>
              </div>

              <div className="card-lg">
                <h2 className="text-lg font-medium mb-4">Wrapped Prompts</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-sm text-gray-700 dark:text-dark-300 mb-2">Smart Wrapped (Auto-detection)</h3>
                    <div className="bg-gray-50 dark:bg-dark-800 rounded-lg p-3 text-sm">
                      {results.results.smartWrapped}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium text-sm text-gray-700 dark:text-dark-300 mb-2">Direct Wrapped (Default)</h3>
                    <div className="bg-gray-50 dark:bg-dark-800 rounded-lg p-3 text-sm">
                      {results.results.directWrapped}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium text-sm text-gray-700 dark:text-dark-300 mb-2">Bold Style</h3>
                    <div className="bg-gray-50 dark:bg-dark-800 rounded-lg p-3 text-sm">
                      {results.results.boldWrapped}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium text-sm text-gray-700 dark:text-dark-300 mb-2">Elegant Style (No Style Preservation)</h3>
                    <div className="bg-gray-50 dark:bg-dark-800 rounded-lg p-3 text-sm">
                      {results.results.elegantWrapped}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="card-lg bg-blue-50 dark:bg-blue-900/20">
            <h3 className="font-medium mb-2">How the Smart Wrapper Works:</h3>
            <ul className="text-sm space-y-1 list-disc list-inside text-gray-700 dark:text-dark-300">
              <li><strong>Raw Text Detection:</strong> Automatically detects if input is simple text vs. complex prompt</li>
              <li><strong>Smart Wrapping:</strong> Only wraps raw text, leaves complex prompts unchanged</li>
              <li><strong>Style Options:</strong> Supports different font styles (modern, bold, elegant, casual)</li>
              <li><strong>Layout Preservation:</strong> Maintains original text positioning and design</li>
              <li><strong>Quality Assurance:</strong> Ensures professional, readable text replacement</li>
            </ul>
            
            <h3 className="font-medium mb-2 mt-4">Test Examples:</h3>
            <ul className="text-sm space-y-1 list-disc list-inside text-gray-700 dark:text-dark-300">
              <li><strong>Raw text:</strong> "New Product Launch" → Gets wrapped automatically</li>
              <li><strong>Complex prompt:</strong> "Replace the text with modern typography" → Left unchanged</li>
              <li><strong>Short instruction:</strong> "Change to blue" → Left unchanged (has instruction keywords)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
} 