'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react'

interface GeeLarkProxy {
  id: string
  scheme: string
  server: string
  port: number
  username: string
  password: string
}

export default function NewProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingProxies, setLoadingProxies] = useState(false)
  const [geelarkProxies, setGeelarkProxies] = useState<GeeLarkProxy[]>([])
  
  const [formData, setFormData] = useState({
    deviceModel: 'Galaxy S23',
    deviceBrand: 'samsung',
    androidVersion: '13',
    assignProxy: true,
    proxySource: 'auto', // 'auto', 'geelark', 'manual', 'dynamic'
    // GeeLark proxy selection
    geelarkProxyId: '',
    // Manual proxy configuration
    manualProxy: {
      typeId: 1, // 1: socks5, 2: http, 3: https
      server: '',
      port: '',
      username: '',
      password: ''
    },
    // Dynamic proxy configuration
    dynamicProxy: {
      typeId: 20, // 20: IPIDEA, 21: IPHTML, 22: kookeey, 23: Lumatuo
      useProxyCfg: false,
      protocol: 1, // 1: SOCKS5, 2: HTTP
      server: '',
      port: '',
      username: '',
      password: '',
      country: '',
      region: '',
      city: ''
    },
    region: 'us',
    language: 'default',
    groupName: 'ungrouped',
    tags: [] as string[],
    remark: ''
  })

  // Fetch GeeLark proxies when proxy source is changed to 'geelark'
  useEffect(() => {
    if (formData.proxySource === 'geelark' && geelarkProxies.length === 0) {
      fetchGeelarkProxies()
    }
  }, [formData.proxySource])

  const fetchGeelarkProxies = async () => {
    setLoadingProxies(true)
    try {
      const response = await fetch('/api/geelark/list-proxies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch GeeLark proxies')
      }

      const data = await response.json()
      setGeelarkProxies(data.proxies || [])
    } catch (error) {
      console.error('Error fetching GeeLark proxies:', error)
      setError('Failed to load GeeLark proxies')
    } finally {
      setLoadingProxies(false)
    }
  }

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

      // Prepare the request body
      const requestBody: any = {
        android_version: androidVersionMap[formData.androidVersion] || 4,
        surface_brand: formData.deviceBrand,
        surface_model: formData.deviceModel,
        region: formData.region,
        language: formData.language,
        charge_mode: 0, // Pay per minute
        group_name: formData.groupName,
        tags: formData.tags,
        remark: formData.remark
      }

      // Handle proxy configuration based on source
      if (formData.assignProxy) {
        if (formData.proxySource === 'auto') {
          // Use automatic proxy assignment from local database
          requestBody.assign_proxy = true
        } else if (formData.proxySource === 'geelark' && formData.geelarkProxyId) {
          // Use GeeLark proxy by ID
          requestBody.proxy_id = formData.geelarkProxyId
        } else if (formData.proxySource === 'manual') {
          // Use manual proxy configuration
          const { server, port, username, password, typeId } = formData.manualProxy
          if (server && port) {
            requestBody.proxy_config = {
              typeId: typeId,
              server: server,
              port: parseInt(port),
              username: username || undefined,
              password: password || undefined
            }
          }
        } else if (formData.proxySource === 'dynamic') {
          // Use dynamic proxy configuration
          const dynamicConfig: any = {
            typeId: formData.dynamicProxy.typeId,
            useProxyCfg: formData.dynamicProxy.useProxyCfg
          }

          if (!formData.dynamicProxy.useProxyCfg) {
            // Only include these fields if not using pre-configured proxy
            if (formData.dynamicProxy.server) dynamicConfig.server = formData.dynamicProxy.server
            if (formData.dynamicProxy.port) dynamicConfig.port = parseInt(formData.dynamicProxy.port)
            if (formData.dynamicProxy.username) dynamicConfig.username = formData.dynamicProxy.username
            if (formData.dynamicProxy.password) dynamicConfig.password = formData.dynamicProxy.password
            if (formData.dynamicProxy.protocol) dynamicConfig.protocol = formData.dynamicProxy.protocol
          }

          // Geographic targeting (optional)
          if (formData.dynamicProxy.country) dynamicConfig.country = formData.dynamicProxy.country
          if (formData.dynamicProxy.region) dynamicConfig.region = formData.dynamicProxy.region
          if (formData.dynamicProxy.city) dynamicConfig.city = formData.dynamicProxy.city

          requestBody.proxy_config = dynamicConfig
        }
      }

      const response = await fetch('/api/geelark/create-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
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
    <div className="max-w-3xl">
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
          
          <div className="grid grid-cols-2 gap-4">
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

            <div>
              <label htmlFor="language" className="label">
                Language
              </label>
              <select
                id="language"
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                className="select w-full"
              >
                <option value="default">English (Default)</option>
                <option value="baseOnIP">Based on IP Location</option>
              </select>
            </div>

            <div>
              <label htmlFor="groupName" className="label">
                Group Name
              </label>
              <input
                id="groupName"
                type="text"
                value={formData.groupName}
                onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
                className="input w-full"
                placeholder="Enter group name"
              />
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="remark" className="label">
              Remark (Optional)
            </label>
            <textarea
              id="remark"
              value={formData.remark}
              onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
              className="input w-full"
              rows={2}
              placeholder="Add any notes about this profile"
              maxLength={1500}
            />
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
                Configure proxy for this profile
              </label>
            </div>

            {formData.assignProxy && (
              <>
                <div>
                  <label className="label">Proxy Source</label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <label className={`flex items-center justify-center px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
                      formData.proxySource === 'auto' 
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' 
                        : 'border-gray-300 dark:border-dark-600 hover:border-gray-400 dark:hover:border-dark-500'
                    }`}>
                      <input
                        type="radio"
                        name="proxySource"
                        value="auto"
                        checked={formData.proxySource === 'auto'}
                        onChange={(e) => setFormData({ ...formData, proxySource: e.target.value })}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium">Auto-assign</span>
                    </label>

                    <label className={`flex items-center justify-center px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
                      formData.proxySource === 'geelark' 
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' 
                        : 'border-gray-300 dark:border-dark-600 hover:border-gray-400 dark:hover:border-dark-500'
                    }`}>
                      <input
                        type="radio"
                        name="proxySource"
                        value="geelark"
                        checked={formData.proxySource === 'geelark'}
                        onChange={(e) => setFormData({ ...formData, proxySource: e.target.value })}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium">GeeLark Proxy</span>
                    </label>

                    <label className={`flex items-center justify-center px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
                      formData.proxySource === 'manual' 
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' 
                        : 'border-gray-300 dark:border-dark-600 hover:border-gray-400 dark:hover:border-dark-500'
                    }`}>
                      <input
                        type="radio"
                        name="proxySource"
                        value="manual"
                        checked={formData.proxySource === 'manual'}
                        onChange={(e) => setFormData({ ...formData, proxySource: e.target.value })}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium">Manual</span>
                    </label>

                    <label className={`flex items-center justify-center px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
                      formData.proxySource === 'dynamic' 
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' 
                        : 'border-gray-300 dark:border-dark-600 hover:border-gray-400 dark:hover:border-dark-500'
                    }`}>
                      <input
                        type="radio"
                        name="proxySource"
                        value="dynamic"
                        checked={formData.proxySource === 'dynamic'}
                        onChange={(e) => setFormData({ ...formData, proxySource: e.target.value })}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium">Dynamic</span>
                    </label>
                  </div>
                </div>

                {/* Auto-assign proxy options */}
                {formData.proxySource === 'auto' && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      A proxy will be automatically assigned from the allowed proxy groups configured in the system.
                    </p>
                  </div>
                )}

                {/* GeeLark proxy selection */}
                {formData.proxySource === 'geelark' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label htmlFor="geelarkProxy" className="label">
                        Select GeeLark Proxy
                      </label>
                      <button
                        type="button"
                        onClick={fetchGeelarkProxies}
                        disabled={loadingProxies}
                        className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                      >
                        <RefreshCw className={`h-3 w-3 ${loadingProxies ? 'animate-spin' : ''}`} />
                        Refresh
                      </button>
                    </div>
                    {loadingProxies ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                        <span className="ml-2 text-sm text-gray-500">Loading proxies...</span>
                      </div>
                    ) : (
                      <select
                        id="geelarkProxy"
                        value={formData.geelarkProxyId}
                        onChange={(e) => setFormData({ ...formData, geelarkProxyId: e.target.value })}
                        className="select w-full"
                        required={formData.proxySource === 'geelark'}
                      >
                        <option value="">Select a proxy</option>
                        {geelarkProxies.map((proxy) => (
                          <option key={proxy.id} value={proxy.id}>
                            {proxy.scheme}://{proxy.server}:{proxy.port} 
                            {proxy.username && ` (${proxy.username})`}
                          </option>
                        ))}
                      </select>
                    )}
                    {geelarkProxies.length === 0 && !loadingProxies && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-dark-400">
                        No proxies found in GeeLark. Add proxies in GeeLark first.
                      </p>
                    )}
                  </div>
                )}

                {/* Manual proxy configuration */}
                {formData.proxySource === 'manual' && (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="manualProxyType" className="label">
                        Proxy Type
                      </label>
                      <select
                        id="manualProxyType"
                        value={formData.manualProxy.typeId}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          manualProxy: { ...formData.manualProxy, typeId: parseInt(e.target.value) }
                        })}
                        className="select w-full"
                      >
                        <option value={1}>SOCKS5</option>
                        <option value={2}>HTTP</option>
                        <option value={3}>HTTPS</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="manualServer" className="label">
                          Server
                        </label>
                        <input
                          id="manualServer"
                          type="text"
                          value={formData.manualProxy.server}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            manualProxy: { ...formData.manualProxy, server: e.target.value }
                          })}
                          className="input w-full"
                          placeholder="proxy.example.com"
                          required={formData.proxySource === 'manual'}
                        />
                      </div>

                      <div>
                        <label htmlFor="manualPort" className="label">
                          Port
                        </label>
                        <input
                          id="manualPort"
                          type="number"
                          value={formData.manualProxy.port}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            manualProxy: { ...formData.manualProxy, port: e.target.value }
                          })}
                          className="input w-full"
                          placeholder="1080"
                          required={formData.proxySource === 'manual'}
                        />
                      </div>

                      <div>
                        <label htmlFor="manualUsername" className="label">
                          Username (Optional)
                        </label>
                        <input
                          id="manualUsername"
                          type="text"
                          value={formData.manualProxy.username}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            manualProxy: { ...formData.manualProxy, username: e.target.value }
                          })}
                          className="input w-full"
                          placeholder="username"
                        />
                      </div>

                      <div>
                        <label htmlFor="manualPassword" className="label">
                          Password (Optional)
                        </label>
                        <input
                          id="manualPassword"
                          type="password"
                          value={formData.manualProxy.password}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            manualProxy: { ...formData.manualProxy, password: e.target.value }
                          })}
                          className="input w-full"
                          placeholder="password"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Dynamic proxy configuration */}
                {formData.proxySource === 'dynamic' && (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="dynamicProvider" className="label">
                        Dynamic Proxy Provider
                      </label>
                      <select
                        id="dynamicProvider"
                        value={formData.dynamicProxy.typeId}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          dynamicProxy: { ...formData.dynamicProxy, typeId: parseInt(e.target.value) }
                        })}
                        className="select w-full"
                      >
                        <option value={20}>IPIDEA</option>
                        <option value={21}>IPHTML</option>
                        <option value={22}>kookeey</option>
                        <option value={23}>Lumatuo</option>
                      </select>
                    </div>

                    <div className="flex items-center">
                      <input
                        id="useProxyCfg"
                        type="checkbox"
                        checked={formData.dynamicProxy.useProxyCfg}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          dynamicProxy: { ...formData.dynamicProxy, useProxyCfg: e.target.checked }
                        })}
                        className="h-4 w-4 text-gray-900 focus:ring-gray-900 border-gray-300 rounded dark:text-dark-100 dark:focus:ring-dark-400 dark:border-dark-600 dark:bg-dark-800"
                      />
                      <label htmlFor="useProxyCfg" className="ml-2 text-sm text-gray-700 dark:text-dark-300">
                        Use pre-configured proxy settings from GeeLark client
                      </label>
                    </div>

                    {!formData.dynamicProxy.useProxyCfg && (
                      <>
                        <div>
                          <label htmlFor="dynamicProtocol" className="label">
                            Protocol
                          </label>
                          <select
                            id="dynamicProtocol"
                            value={formData.dynamicProxy.protocol}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              dynamicProxy: { ...formData.dynamicProxy, protocol: parseInt(e.target.value) }
                            })}
                            className="select w-full"
                          >
                            <option value={1}>SOCKS5</option>
                            <option value={2}>HTTP</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label htmlFor="dynamicServer" className="label">
                              Server
                            </label>
                            <input
                              id="dynamicServer"
                              type="text"
                              value={formData.dynamicProxy.server}
                              onChange={(e) => setFormData({ 
                                ...formData, 
                                dynamicProxy: { ...formData.dynamicProxy, server: e.target.value }
                              })}
                              className="input w-full"
                              placeholder="proxy.provider.com"
                            />
                          </div>

                          <div>
                            <label htmlFor="dynamicPort" className="label">
                              Port
                            </label>
                            <input
                              id="dynamicPort"
                              type="number"
                              value={formData.dynamicProxy.port}
                              onChange={(e) => setFormData({ 
                                ...formData, 
                                dynamicProxy: { ...formData.dynamicProxy, port: e.target.value }
                              })}
                              className="input w-full"
                              placeholder="1080"
                            />
                          </div>

                          <div>
                            <label htmlFor="dynamicUsername" className="label">
                              Username
                            </label>
                            <input
                              id="dynamicUsername"
                              type="text"
                              value={formData.dynamicProxy.username}
                              onChange={(e) => setFormData({ 
                                ...formData, 
                                dynamicProxy: { ...formData.dynamicProxy, username: e.target.value }
                              })}
                              className="input w-full"
                              placeholder="username"
                            />
                          </div>

                          <div>
                            <label htmlFor="dynamicPassword" className="label">
                              Password
                            </label>
                            <input
                              id="dynamicPassword"
                              type="password"
                              value={formData.dynamicProxy.password}
                              onChange={(e) => setFormData({ 
                                ...formData, 
                                dynamicProxy: { ...formData.dynamicProxy, password: e.target.value }
                              })}
                              className="input w-full"
                              placeholder="password"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <div className="border-t pt-3">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                        Geographic Targeting (Optional)
                      </h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label htmlFor="dynamicCountry" className="label">
                            Country
                          </label>
                          <input
                            id="dynamicCountry"
                            type="text"
                            value={formData.dynamicProxy.country}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              dynamicProxy: { ...formData.dynamicProxy, country: e.target.value }
                            })}
                            className="input w-full"
                            placeholder="us"
                          />
                        </div>

                        <div>
                          <label htmlFor="dynamicRegion" className="label">
                            Region/State
                          </label>
                          <input
                            id="dynamicRegion"
                            type="text"
                            value={formData.dynamicProxy.region}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              dynamicProxy: { ...formData.dynamicProxy, region: e.target.value }
                            })}
                            className="input w-full"
                            placeholder="california"
                          />
                        </div>

                        <div>
                          <label htmlFor="dynamicCity" className="label">
                            City
                          </label>
                          <input
                            id="dynamicCity"
                            type="text"
                            value={formData.dynamicProxy.city}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              dynamicProxy: { ...formData.dynamicProxy, city: e.target.value }
                            })}
                            className="input w-full"
                            placeholder="los angeles"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
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