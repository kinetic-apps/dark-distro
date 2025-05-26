import { useState, useEffect } from 'react'
import { GoogleAuthService } from '@/lib/services/google-auth'
import { GoogleDriveService } from '@/lib/services/google-drive'
import { X, Upload, LogOut, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface GoogleDriveExportModalProps {
  isOpen: boolean
  onClose: () => void
  job?: any
  variant?: any
}

export default function GoogleDriveExportModal({
  isOpen,
  onClose,
  job,
  variant
}: GoogleDriveExportModalProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState({
    current: 0,
    total: 0,
    status: ''
  })
  const [exportComplete, setExportComplete] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const authService = GoogleAuthService.getInstance()
  const driveService = GoogleDriveService.getInstance()

  useEffect(() => {
    if (isOpen) {
      checkAuthStatus()
    }
  }, [isOpen])

  const checkAuthStatus = async () => {
    const authenticated = authService.isAuthenticated()
    setIsAuthenticated(authenticated)
    
    if (authenticated) {
      const userInfo = await authService.getUserInfo()
      setUserEmail(userInfo?.email || null)
    }
  }

  const handleGoogleSignIn = () => {
    const authUrl = authService.getAuthUrl()
    window.location.href = authUrl
  }

  const handleSignOut = () => {
    authService.signOut()
    setIsAuthenticated(false)
    setUserEmail(null)
  }

  const handleExport = async () => {
    setIsExporting(true)
    setExportError(null)
    setExportComplete(false)

    try {
      let success = false
      
      if (variant && job) {
        // Export single variant
        success = await driveService.exportCarouselVariant(
          variant,
          job.name,
          setExportProgress
        )
      } else if (job) {
        // Export entire job
        success = await driveService.exportEntireJob(
          job,
          setExportProgress
        )
      }

      if (success) {
        setExportComplete(true)
      } else {
        setExportError('Export failed. Please try again.')
      }
    } catch (error) {
      console.error('Export error:', error)
      setExportError('An error occurred during export.')
    } finally {
      setIsExporting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-850 rounded-lg max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-100">
            Export to Google Drive
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:text-dark-400 dark:hover:text-dark-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {!isAuthenticated ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-dark-100 mb-2">
                  Sign in to Google Drive
                </h3>
                <p className="text-sm text-gray-600 dark:text-dark-400 mb-4">
                  Connect your Google account to export carousels directly to your Drive
                </p>
                <button
                  onClick={handleGoogleSignIn}
                  className="btn-primary w-full"
                >
                  Sign in with Google
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* User info */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {userEmail?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-dark-100">
                      {userEmail}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-dark-400">
                      Connected to Google Drive
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:text-dark-400 dark:hover:text-dark-200"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>

              {/* Export info */}
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900 dark:text-dark-100">
                  Export Details
                </h4>
                <div className="text-sm text-gray-600 dark:text-dark-400 space-y-1">
                  {variant ? (
                    <>
                      <p>Job: {job?.name}</p>
                      <p>Variant: {variant.variant_index + 1}</p>
                      <p>Slides: {variant.slide_count}</p>
                    </>
                  ) : (
                    <>
                      <p>Job: {job?.name}</p>
                      <p>Variants: {job?.carousel_variants?.length || 0}</p>
                      <p>Total slides: {
                        job?.carousel_variants?.reduce(
                          (sum: number, v: any) => sum + (v.slide_count || 0), 0
                        ) || 0
                      }</p>
                    </>
                  )}
                </div>
              </div>

              {/* Export progress */}
              {isExporting && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-dark-400">
                      {exportProgress.status}
                    </span>
                    <span className="text-gray-900 dark:text-dark-100">
                      {exportProgress.current} / {exportProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${
                          exportProgress.total > 0
                            ? (exportProgress.current / exportProgress.total) * 100
                            : 0
                        }%`
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Success message */}
              {exportComplete && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-sm">Export completed successfully!</span>
                </div>
              )}

              {/* Error message */}
              {exportError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg">
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-sm">{exportError}</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                {!isExporting && !exportComplete && (
                  <button
                    onClick={handleExport}
                    className="btn-primary flex-1"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Export to Drive
                  </button>
                )}
                {exportComplete && (
                  <button
                    onClick={onClose}
                    className="btn-primary flex-1"
                  >
                    Done
                  </button>
                )}
                {!exportComplete && (
                  <button
                    onClick={onClose}
                    disabled={isExporting}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 