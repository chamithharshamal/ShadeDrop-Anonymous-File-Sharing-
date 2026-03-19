'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ConfirmModal'
import { supabase, supabaseService } from '@/lib/supabaseClient'
import { isPreviewable, generatePreviewUrl } from '@/lib/filePreview'
import { GhostFile } from '@/lib/supabaseClient'
import { EyeIcon, EyeOffIcon } from '@/components/Icons'


export default function DownloadPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [file, setFile] = useState<GhostFile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false) // State for password visibility
  const [passwordError, setPasswordError] = useState('') // New state for password-specific errors
  const [showPasswordInput, setShowPasswordInput] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    const fetchFile = async () => {
      try {
        // Get the actual params value
        const { id } = await params
        
        console.log('Fetching file with ID:', id)
        
        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(id)) {
          console.error('Invalid UUID format:', id)
          setError('Invalid file ID format. Please check the link and try again.')
          setLoading(false)
          return
        }
        
        // Check if Supabase is configured
        if (!supabase) {
          console.error('Supabase not configured')
          setError('Application not properly configured. Please contact administrator.')
          setLoading(false)
          return
        }

        // Try to fetch file with regular client first
        console.log('Attempting to fetch file with regular client')
        let { data, error } = await supabase
          .from('files')
          .select('*')
          .eq('id', id)
        
        console.log('Query result:', { data, error })

        // If regular client fails, try with service client
        if (error) {
          console.log('Regular client failed:', error.message)
          if (supabaseService) {
            console.log('Trying with service client...')
            const serviceResult = await supabaseService
              .from('files')
              .select('*')
              .eq('id', id)
            
            console.log('Service client result:', serviceResult)
            
            if (serviceResult.data && serviceResult.data.length > 0) {
              console.log('Service client succeeded')
              data = serviceResult.data
              error = null
            } else {
              console.log('Service client also failed or no data found:', serviceResult.error?.message)
              // Keep the original error from the regular client
            }
          }
        }
        
        // Handle the case where we get an array but expect a single object
        let fileData = null
        if (data && Array.isArray(data)) {
          if (data.length === 1) {
            fileData = data[0]
          } else if (data.length === 0) {
            console.log('No file found with ID:', id)
            setError(`File not found. This could happen if:
1. The file was never uploaded successfully
2. The file has expired
3. The file was deleted
4. The link is incorrect
5. There's a database access policy issue

Please contact the person who shared this link with you.`)
            setLoading(false)
            return
          } else {
            console.log('Multiple files found with ID:', id)
            setError('Multiple files found with this ID (unexpected). Please contact administrator.')
            setLoading(false)
            return
          }
        } else if (data) {
          fileData = data
        }

        if (error) {
          console.error('Database error:', error)
          if (error.message.includes('PGRST205') || error.message.includes('not found')) {
            setError('File not found or database not initialized. Please contact administrator.')
          } else if (error.message.includes('row-level security')) {
            setError('Database access policy issue. Please contact administrator.')
          } else {
            setError('File not found. The file may have been deleted or expired.')
          }
          setLoading(false)
          return
        }
        
        if (!fileData) {
          console.error('No data returned from database')
          setError(`File not found. This could happen if:
1. The file was never uploaded successfully
2. The file has expired
3. The file was deleted
4. The link is incorrect
5. There's a database access policy issue

Please contact the person who shared this link with you.`)
          setLoading(false)
          return
        }

        console.log('File data retrieved:', fileData)

        // Check if file has expired
        const now = new Date()
        const expiresAt = new Date(fileData.expires_at)
        if (now > expiresAt) {
          setError('This file has expired and is no longer available.')
          setLoading(false)
          return
        }

        // Check if file has already been sent (for one-time downloads)
        if (fileData.one_time && fileData.sent) {
          setError('This file has already been downloaded and is no longer available.')
          setLoading(false)
          return
        }

        setFile(fileData)
        
        // Check if password is required
        if (fileData.password_hash) {
          setShowPasswordInput(true)
        } else {
          // Generate preview for previewable files
          if (isPreviewable(fileData.mime_type)) {
            try {
              const url = await generatePreviewUrl(fileData.storage_path)
              setPreviewUrl(url)
            } catch (previewError) {
              console.error('Preview generation error:', previewError)
            }
          }
        }
      } catch (err) {
        console.error('Fetch file error:', err)
        setError(err instanceof Error ? err.message : 'Failed to load file. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchFile()
  }, [])

  const handleDownload = async () => {
    setDownloading(true)
    setError('')
    setPasswordError('') // Clear password error on new attempt

    try {
      // Get the actual params value
      const { id } = await params
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(id)) {
        throw new Error('Invalid file ID format')
      }
      
      // Construct download URL with token and password if needed
      let downloadUrl = `/api/download/${id}`
      
      // Add password to query params if provided
      if (password) {
        downloadUrl += `?password=${encodeURIComponent(password)}`
      }

      console.log('Redirecting to download URL:', downloadUrl)
      
      // First check if password is valid by making a HEAD request
      if (password) {
        const response = await fetch(downloadUrl, { method: 'HEAD' })
        if (response.status === 401) {
          // Password is invalid
          setPasswordError('Incorrect password')
          setDownloading(false)
          return
        }
      }
      
      // Redirect to download API endpoint
      window.location.href = downloadUrl
    } catch (err) {
      console.error('Download error:', err)
      setError(err instanceof Error ? err.message : 'Failed to download file')
      setDownloading(false)
    }
  }

  // New function to verify password before deletion
  const verifyPasswordForDeletion = async (fileId: string, password: string) => {
    try {
      // Construct download URL with token and password
      const downloadUrl = `/api/download/${fileId}?password=${encodeURIComponent(password)}`
      
      // Check if password is valid by making a HEAD request
      const response = await fetch(downloadUrl, { method: 'HEAD' })
      return response.status !== 401; // Return true if password is correct
    } catch (err) {
      console.error('Password verification error:', err)
      return false;
    }
  }

  const handleDelete = async () => {
    if (!file) return
    
    // If file is password protected, verify password before showing delete confirmation
    if (file.password_hash && password) {
      const isPasswordValid = await verifyPasswordForDeletion(file.id, password)
      if (!isPasswordValid) {
        setPasswordError('Incorrect password. Cannot delete file.')
        return
      }
      // If password is valid, proceed to show confirmation
    } else if (file.password_hash && !password) {
      setPasswordError('Password is required to delete this file')
      return
    }
    
    // Show custom confirm modal instead of browser dialog
    setShowDeleteConfirm(true)
  }
  
  const confirmDelete = async () => {
    setDeleting(true)
    setError('')

    try {
      // Get the actual params value
      const { id } = await params
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(id)) {
        throw new Error('Invalid file ID format')
      }
      
      // Call delete API endpoint
      const response = await fetch(`/api/delete/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: password || undefined }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete file')
      }

      // Redirect to home page after successful deletion
      router.push('/')
    } catch (err) {
      console.error('Delete error:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete file')
      setDeleting(false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' bytes'
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    else return (bytes / 1048576).toFixed(1) + ' MB'
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto"></div>
          <p className="mt-4">Loading file...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-red-400 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-2">Download Error</h1>
          <p className="text-gray-300 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-teal-600 hover:bg-teal-500 py-2 px-4 rounded-lg"
          >
            Upload Your Own File
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center py-8">
          <div className="flex items-center justify-center mb-4">
            <svg 
              className="w-10 h-10 text-teal-400 mr-3" 
              viewBox="0 0 24 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                d="M12 2C8.5 2 6 4.5 6 8C6 11.5 8.5 13 8.5 13C8.5 13 6 14.5 6 18C6 21.5 8.5 23 12 23C15.5 23 18 21.5 18 18C18 14.5 15.5 13 15.5 13C15.5 13 18 11.5 18 8C18 4.5 15.5 2 12 2Z" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              <path 
                d="M12 8C13.1046 8 14 7.10457 14 6C14 4.89543 13.1046 4 12 4C10.8954 4 10 4.89543 10 6C10 7.10457 10.8954 8 12 8Z" 
                fill="currentColor"
              />
              <path 
                d="M9 12H9.01" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              <path 
                d="M15 12H15.01" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
            <h1 className="text-3xl md:text-4xl font-bold text-teal-400">ShadeDrop</h1>
          </div>
          <p className="text-gray-400 mt-2">Secure, anonymous file sharing</p>
        </header>

        <main className="bg-gray-800 rounded-xl p-6 md:p-8 shadow-lg">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold">File Download</h2>
            <p className="text-gray-400 mt-2">{file?.filename}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="font-medium mb-3">File Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">File Name:</span>
                    <span className="truncate max-w-[50%]">{file?.filename}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">File Size:</span>
                    <span>{file && formatFileSize(file.size)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">File Type:</span>
                    <span>{file?.mime_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Expires:</span>
                    <span>{file && formatDate(file.expires_at)}</span>
                  </div>
                  {(file?.one_time || file?.delete_after_send) && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Delete after download:</span>
                      <span>Yes</span>
                    </div>
                  )}

                </div>
              </div>

              {showPasswordInput && (
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="font-medium mb-3">Password Required</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    This file is protected with a password. Please enter the password to download.
                  </p>
                  <div className="relative mb-3">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        if (passwordError) setPasswordError('') // Clear error when user types
                      }}
                      placeholder="Enter password"
                      className="w-full bg-gray-600 border border-gray-500 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                    >
                      {showPassword ? (
                        <EyeOffIcon className="w-5 h-5" />
                      ) : (
                        <EyeIcon className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {passwordError && (
                    <div className="text-red-400 text-sm mb-3">
                      {passwordError}
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-red-200">
                  {error}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleDownload}
                  disabled={downloading || (showPasswordInput && !password)}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                    downloading || (showPasswordInput && !password)
                      ? 'bg-gray-700 cursor-not-allowed'
                      : 'bg-teal-600 hover:bg-teal-500'
                  }`}
                >
                  Download File
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                    deleting
                      ? 'bg-gray-700 cursor-not-allowed'
                      : 'bg-red-600 hover:bg-red-500'
                  }`}
                >
                  Delete File
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {previewUrl && file && (
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-medium">File Preview</h3>
                    <button 
                      onClick={() => setShowPreview(!showPreview)}
                      className="text-teal-400 hover:text-teal-300 text-sm"
                    >
                      {showPreview ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  
                  {showPreview && (
                    <div className="mt-2 max-h-64 overflow-hidden rounded-lg">
                      {file.mime_type.startsWith('image/') ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img 
                          src={previewUrl} 
                          alt="Preview" 
                          className="max-w-full max-h-64 object-contain"
                        />
                      ) : file.mime_type === 'application/pdf' ? (
                        <iframe 
                          src={previewUrl} 
                          className="w-full h-64"
                          title="PDF Preview"
                        />
                      ) : (
                        <div className="bg-gray-600 p-4 rounded-lg text-center">
                          <p>Preview not available for this file type</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="font-medium mb-3">Security Information</h3>
                <ul className="text-sm space-y-2 text-gray-300">
                  <li className="flex items-start">
                    <span className="text-teal-400 mr-2">•</span>
                    <span>This file is securely stored and encrypted in transit</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-teal-400 mr-2">•</span>
                    <span>Download link expires on {file && formatDate(file.expires_at)}</span>
                  </li>
                  {(file?.one_time || file?.delete_after_send) && (
                    <li className="flex items-start">
                      <span className="text-teal-400 mr-2">•</span>
                      <span>This file will be deleted after download</span>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </main>

        <footer className="text-center text-gray-500 text-sm mt-8">
          <p>ShadeDrop - Secure, anonymous file sharing</p>
        </footer>
      </div>
      
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete File"
        message="Are you sure you want to delete this file? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  )
}
