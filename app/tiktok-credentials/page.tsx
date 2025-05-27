'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, Plus, Search, Edit, Trash2, Eye, EyeOff, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

interface TikTokCredential {
  id?: string
  email: string
  password: string
  creator_name?: string
  creator_id?: string
  status: 'active' | 'inactive' | 'suspended'
  last_used_at?: string
  created_at?: string
  updated_at?: string
}

interface PreviewData {
  valid: TikTokCredential[]
  invalid: { row: number; data: any; errors: string[] }[]
}

export default function TikTokCredentialsPage() {
  const [credentials, setCredentials] = useState<TikTokCredential[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false)
  const [editingCredential, setEditingCredential] = useState<TikTokCredential | null>(null)
  const [activeTab, setActiveTab] = useState<'list' | 'import'>('list')
  const [manualForm, setManualForm] = useState({
    email: '',
    password: '',
    creator_name: '',
    creator_id: ''
  })

  const supabase = createClient()

  useEffect(() => {
    fetchCredentials()
  }, [])

  const fetchCredentials = async () => {
    try {
      const { data, error } = await supabase
        .from('tiktok_credentials')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setCredentials(data || [])
    } catch (error) {
      console.error('Error fetching credentials:', error)
      toast.error('Failed to fetch credentials')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadFile(file)
    const reader = new FileReader()

    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)

        // Process and validate data
        const processed = processExcelData(jsonData)
        setPreviewData(processed)
      } catch (error) {
        console.error('Error processing file:', error)
        toast.error('Failed to process Excel file')
      }
    }

    reader.readAsArrayBuffer(file)
  }

  const processExcelData = (data: any[]): PreviewData => {
    const valid: TikTokCredential[] = []
    const invalid: { row: number; data: any; errors: string[] }[] = []

    data.forEach((row, index) => {
      const errors: string[] = []
      
      // Try to find email and password in various column names
      const email = row.email || row.Email || row.EMAIL || row.username || row.Username || ''
      const password = row.password || row.Password || row.PASSWORD || row.pass || row.Pass || ''
      const creator_name = row.creator_name || row.creator || row.name || row.Name || ''
      const creator_id = row.creator_id || row.id || row.ID || ''

      if (!email) errors.push('Email is required')
      if (!password) errors.push('Password is required')
      if (email && !email.includes('@')) errors.push('Invalid email format')

      if (errors.length === 0) {
        valid.push({
          email: email.trim(),
          password: password.trim(),
          creator_name: creator_name.trim(),
          creator_id: creator_id.toString().trim(),
          status: 'active'
        })
      } else {
        invalid.push({ row: index + 2, data: row, errors }) // +2 for Excel row number (1-indexed + header)
      }
    })

    return { valid, invalid }
  }

  const handleImportApproved = async () => {
    if (!previewData?.valid.length) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('tiktok_credentials')
        .insert(previewData.valid)

      if (error) throw error

      toast.success(`Successfully imported ${previewData.valid.length} credentials`)
      setPreviewData(null)
      setUploadFile(null)
      fetchCredentials()
    } catch (error) {
      console.error('Error importing credentials:', error)
      toast.error('Failed to import credentials')
    } finally {
      setLoading(false)
    }
  }

  const handleManualSubmit = async () => {
    try {
      const credential: TikTokCredential = {
        ...manualForm,
        status: 'active'
      }

      if (editingCredential?.id) {
        const { error } = await supabase
          .from('tiktok_credentials')
          .update(credential)
          .eq('id', editingCredential.id)

        if (error) throw error
        toast.success('Credential updated successfully')
      } else {
        const { error } = await supabase
          .from('tiktok_credentials')
          .insert([credential])

        if (error) throw error
        toast.success('Credential added successfully')
      }

      setIsManualDialogOpen(false)
      setEditingCredential(null)
      setManualForm({ email: '', password: '', creator_name: '', creator_id: '' })
      fetchCredentials()
    } catch (error) {
      console.error('Error saving credential:', error)
      toast.error('Failed to save credential')
    }
  }

  const handleEdit = (credential: TikTokCredential) => {
    setEditingCredential(credential)
    setManualForm({
      email: credential.email,
      password: credential.password,
      creator_name: credential.creator_name || '',
      creator_id: credential.creator_id || ''
    })
    setIsManualDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this credential?')) return

    try {
      const { error } = await supabase
        .from('tiktok_credentials')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Credential deleted successfully')
      fetchCredentials()
    } catch (error) {
      console.error('Error deleting credential:', error)
      toast.error('Failed to delete credential')
    }
  }

  const handleStatusChange = async (id: string, status: 'active' | 'inactive' | 'suspended') => {
    try {
      const { error } = await supabase
        .from('tiktok_credentials')
        .update({ status })
        .eq('id', id)

      if (error) throw error
      toast.success('Status updated successfully')
      fetchCredentials()
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status')
    }
  }

  const filteredCredentials = credentials.filter(cred =>
    cred.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cred.creator_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cred.creator_id?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      active: 'status-active',
      inactive: 'status-neutral',
      suspended: 'status-error'
    }
    return statusClasses[status as keyof typeof statusClasses] || 'status-neutral'
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="page-title">TikTok Credentials</h1>
          <p className="page-description">Manage TikTok account credentials for automation</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowPasswords(!showPasswords)} className="btn-secondary">
            {showPasswords ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showPasswords ? 'Hide' : 'Show'} Passwords
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-dark-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('list')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'list'
                ? 'border-gray-900 text-gray-900 dark:border-dark-100 dark:text-dark-100'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-dark-400 dark:hover:text-dark-200'
            }`}
          >
            Credentials List
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'import'
                ? 'border-gray-900 text-gray-900 dark:border-dark-100 dark:text-dark-100'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-dark-400 dark:hover:text-dark-200'
            }`}
          >
            Import from Excel
          </button>
        </nav>
      </div>

      {/* List Tab */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          <div className="card-lg">
            <div className="flex justify-between items-center mb-6">
              <div className="flex-1 max-w-sm">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search credentials..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input pl-10"
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingCredential(null)
                  setManualForm({ email: '', password: '', creator_name: '', creator_id: '' })
                  setIsManualDialogOpen(true)
                }}
                className="btn-primary"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Credential
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
                <thead className="bg-gray-50 dark:bg-dark-800">
                  <tr>
                    <th className="table-header">Email</th>
                    <th className="table-header">Password</th>
                    <th className="table-header">Creator</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Last Used</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 dark:bg-dark-850 dark:divide-dark-700">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="table-cell text-center">Loading...</td>
                    </tr>
                  ) : filteredCredentials.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="table-cell text-center">No credentials found</td>
                    </tr>
                  ) : (
                    filteredCredentials.map((cred) => (
                      <tr key={cred.id}>
                        <td className="table-cell font-medium">{cred.email}</td>
                        <td className="table-cell">
                          {showPasswords ? cred.password : '••••••••'}
                        </td>
                        <td className="table-cell">
                          <div>
                            {cred.creator_name && <div className="font-medium">{cred.creator_name}</div>}
                            {cred.creator_id && <div className="text-xs text-gray-500 dark:text-dark-400">ID: {cred.creator_id}</div>}
                          </div>
                        </td>
                        <td className="table-cell">
                          <span className={getStatusBadge(cred.status)}>{cred.status}</span>
                        </td>
                        <td className="table-cell">
                          {cred.last_used_at ? new Date(cred.last_used_at).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="table-cell">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(cred)}
                              className="text-gray-600 hover:text-gray-900 dark:text-dark-400 dark:hover:text-dark-100"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(cred.id!)}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div className="space-y-4">
          <div className="card-lg">
            <h2 className="text-lg font-medium mb-2">Import from Excel</h2>
            <p className="text-sm text-gray-600 dark:text-dark-400 mb-6">
              Upload an Excel file containing TikTok credentials. The file should have columns for email, password, and optionally creator_name and creator_id.
            </p>

            <div className="border-2 border-dashed border-gray-300 dark:border-dark-600 rounded-lg p-6 text-center">
              <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400" />
              <div className="mt-4">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="mt-2 block text-sm font-medium text-gray-900 dark:text-dark-100">
                    Click to upload or drag and drop
                  </span>
                  <input
                    id="file-upload"
                    type="file"
                    className="sr-only"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                  />
                </label>
                <p className="mt-1 text-xs text-gray-500 dark:text-dark-400">Excel files up to 10MB</p>
              </div>
            </div>

            {uploadFile && (
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-800 rounded-lg">
                <span className="text-sm font-medium">{uploadFile.name}</span>
                <button
                  onClick={() => {
                    setUploadFile(null)
                    setPreviewData(null)
                  }}
                  className="text-gray-600 hover:text-gray-900 dark:text-dark-400 dark:hover:text-dark-100"
                >
                  Remove
                </button>
              </div>
            )}

            {previewData && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="card">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <h3 className="font-medium">Valid Records</h3>
                    </div>
                    <p className="text-2xl font-bold">{previewData.valid.length}</p>
                  </div>
                  <div className="card">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="h-5 w-5 text-red-500" />
                      <h3 className="font-medium">Invalid Records</h3>
                    </div>
                    <p className="text-2xl font-bold">{previewData.invalid.length}</p>
                  </div>
                </div>

                {previewData.valid.length > 0 && (
                  <div className="card">
                    <h3 className="font-medium mb-4">Preview Valid Records</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
                        <thead>
                          <tr>
                            <th className="table-header">Email</th>
                            <th className="table-header">Password</th>
                            <th className="table-header">Creator</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                          {previewData.valid.slice(0, 5).map((cred, idx) => (
                            <tr key={idx}>
                              <td className="table-cell">{cred.email}</td>
                              <td className="table-cell">{showPasswords ? cred.password : '••••••••'}</td>
                              <td className="table-cell">
                                {cred.creator_name || '-'}
                                {cred.creator_id && <span className="text-xs text-gray-500 ml-2">(ID: {cred.creator_id})</span>}
                              </td>
                            </tr>
                          ))}
                          {previewData.valid.length > 5 && (
                            <tr>
                              <td colSpan={3} className="table-cell text-center text-gray-500">
                                ... and {previewData.valid.length - 5} more records
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {previewData.invalid.length > 0 && (
                  <div className="card border-red-200 dark:border-red-900">
                    <h3 className="font-medium text-red-600 dark:text-red-400 mb-4">Invalid Records</h3>
                    <div className="space-y-2">
                      {previewData.invalid.slice(0, 5).map((item, idx) => (
                        <div key={idx} className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">Row {item.row}</p>
                              <ul className="text-sm text-red-600 dark:text-red-400 mt-1">
                                {item.errors.map((error, errIdx) => (
                                  <li key={errIdx}>• {error}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      ))}
                      {previewData.invalid.length > 5 && (
                        <p className="text-center text-sm text-gray-500">
                          ... and {previewData.invalid.length - 5} more errors
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setPreviewData(null)
                      setUploadFile(null)
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImportApproved}
                    disabled={previewData.valid.length === 0}
                    className="btn-primary"
                  >
                    Import {previewData.valid.length} Valid Records
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Entry Dialog */}
      {isManualDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-850 rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">{editingCredential ? 'Edit' : 'Add'} TikTok Credential</h2>
              <button
                onClick={() => setIsManualDialogOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-dark-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-dark-400 mb-4">
              Enter the TikTok account details below.
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="label">Email</label>
                <input
                  id="email"
                  type="email"
                  value={manualForm.email}
                  onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })}
                  placeholder="user@example.com"
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="password" className="label">Password</label>
                <input
                  id="password"
                  type={showPasswords ? 'text' : 'password'}
                  value={manualForm.password}
                  onChange={(e) => setManualForm({ ...manualForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="creator_name" className="label">Creator Name (Optional)</label>
                <input
                  id="creator_name"
                  value={manualForm.creator_name}
                  onChange={(e) => setManualForm({ ...manualForm, creator_name: e.target.value })}
                  placeholder="John Doe"
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="creator_id" className="label">Creator ID (Optional)</label>
                <input
                  id="creator_id"
                  value={manualForm.creator_id}
                  onChange={(e) => setManualForm({ ...manualForm, creator_id: e.target.value })}
                  placeholder="CREATOR123"
                  className="input"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setIsManualDialogOpen(false)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleManualSubmit} className="btn-primary">
                {editingCredential ? 'Update' : 'Add'} Credential
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 