'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NewProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    deviceModel: 'Galaxy S23',
    deviceBrand: 'samsung',
    androidVersion: '13',
    assignProxy: true,
    proxyType: 'sticky',
    region: 'us',
    language: 'default'
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Map Android version string to number
      const androidVersionMap: { [key: string]: number } = {
        '10': 1,
        '11': 2,
        '12': 3,
        '13': 4,
        '14': 7,
        '15': 8
      }

      const response = await fetch('/api/geelark/create-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          android_version: androidVersionMap[formData.androidVersion] || 4,
          surface_brand: formData.deviceBrand,
          surface_model: formData.deviceModel,
          assign_proxy: formData.assignProxy,
          proxy_type: formData.proxyType,
          region: formData.region,
          language: formData.language,
          charge_mode: 0, // Pay per minute
          group_name: 'ungrouped',
          tags: []
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create profile')
      }

      const data = await response.json()
      router.push(`/profiles/${data.account_id}`)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/profiles" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="page-title">Create New Profile</h1>
          <p className="page-description">
            Set up a new GeeLark phone profile
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6">
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4 dark:text-dark-100">Device Configuration</h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="deviceBrand" className="label">
                Device Brand
              </label>
              <select
                id="deviceBrand"
                value={formData.deviceBrand}
                onChange={(e) => {
                  setFormData({ ...formData, deviceBrand: e.target.value })
                  // Reset model when brand changes
                  if (e.target.value === 'Google') {
                    setFormData({ ...formData, deviceBrand: e.target.value, deviceModel: 'Pixel 6' })
                  } else if (e.target.value === 'samsung') {
                    setFormData({ ...formData, deviceBrand: e.target.value, deviceModel: 'Galaxy S23' })
                  }
                }}
                className="select w-full"
              >
                <option value="samsung">Samsung</option>
                <option value="Google">Google</option>
                <option value="OnePlus">OnePlus</option>
              </select>
            </div>

            <div>
              <label htmlFor="deviceModel" className="label">
                Device Model
              </label>
              <select
                id="deviceModel"
                value={formData.deviceModel}
                onChange={(e) => setFormData({ ...formData, deviceModel: e.target.value })}
                className="select w-full"
              >
                {formData.deviceBrand === 'Google' && (
                  <>
                    <option value="Pixel 6">Pixel 6</option>
                    <option value="Pixel 7">Pixel 7</option>
                    <option value="Pixel 8">Pixel 8</option>
                  </>
                )}
                {formData.deviceBrand === 'samsung' && (
                  <>
                    <option value="Galaxy S22">Galaxy S22</option>
                    <option value="Galaxy S23">Galaxy S23</option>
                    <option value="Galaxy S24">Galaxy S24</option>
                  </>
                )}
                {formData.deviceBrand === 'OnePlus' && (
                  <>
                <option value="OnePlus 10">OnePlus 10</option>
                    <option value="OnePlus 11">OnePlus 11</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label htmlFor="androidVersion" className="label">
                Android Version
              </label>
              <select
                id="androidVersion"
                value={formData.androidVersion}
                onChange={(e) => setFormData({ ...formData, androidVersion: e.target.value })}
                className="select w-full"
              >
                <option value="15">Android 15</option>
                <option value="14">Android 14 (Monthly subscription only)</option>
                <option value="13">Android 13</option>
                <option value="12">Android 12</option>
                <option value="11">Android 11</option>
                <option value="10">Android 10</option>
              </select>
            </div>

            <div>
              <label htmlFor="region" className="label">
                Region
              </label>
              <select
                id="region"
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                className="select w-full"
              >
                <option value="us">United States</option>
                <option value="cn">China</option>
                <option value="sgp">Singapore</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4 dark:text-dark-100">Proxy Configuration</h2>
          
          <div className="space-y-4">
            <div className="flex items-center">
                              <input
                  id="assignProxy"
                  type="checkbox"
                  checked={formData.assignProxy}
                  onChange={(e) => setFormData({ ...formData, assignProxy: e.target.checked })}
                  className="h-4 w-4 text-gray-900 focus:ring-gray-900 border-gray-300 rounded dark:text-dark-100 dark:focus:ring-dark-400 dark:border-dark-600 dark:bg-dark-800"
                />
                <label htmlFor="assignProxy" className="ml-2 text-sm text-gray-700 dark:text-dark-300">
                  Assign proxy automatically
                </label>
            </div>

            {formData.assignProxy && (
              <div>
                <label htmlFor="proxyType" className="label">
                  Proxy Type
                </label>
                <select
                  id="proxyType"
                  value={formData.proxyType}
                  onChange={(e) => setFormData({ ...formData, proxyType: e.target.value })}
                  className="select w-full"
                >
                  <option value="sticky">Sticky Pool (for warm-up)</option>
                  <option value="sim">Dedicated SIM (for posting)</option>
                </select>
                                  <p className="mt-1 text-xs text-gray-500 dark:text-dark-400">
                    Sticky proxies are recommended for new profiles during warm-up
                  </p>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Creating...' : 'Create Profile'}
          </button>
          <Link href="/profiles" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}