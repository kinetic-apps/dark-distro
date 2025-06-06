import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { waitForPhoneReady } from '@/lib/utils/geelark-phone-status'
import { monitorPostCompletionAndStop } from '@/lib/utils/post-completion-monitor'

/**
 * SYSTEM TIMEOUT VALUES:
 * 
 * Phone Lifecycle Timeouts:
 * - Phone ready waiting: 10 minutes (300 attempts × 2s)
 * - Post completion monitoring: 60 minutes (video/carousel posting)
 * - Engagement task monitoring: 30 minutes (likes, comments, follows)
 * - Setup completion monitoring: 30 minutes (phone setup operations)
 * - SMS setup process: 30 minutes (entire SMS workflow)
 * 
 * File Transfer Timeouts:
 * - Image download: 30 seconds
 * - Video download: 60 seconds  
 * - Image upload: 30 seconds
 * - Video upload: 30s + 1s per MB (dynamic based on file size)
 * 
 * The 60-minute post monitoring timeout is the longest arbitrary timeout in the system.
 * All timeouts include automatic phone stopping as a safety measure.
 */

const API_BASE_URL = process.env.GEELARK_API_BASE_URL || 'https://openapi.geelark.com'
const API_KEY = process.env.GEELARK_API_KEY || ''
const APP_ID = process.env.GEELARK_APP_ID || ''

// Log configuration for debugging
console.log('GeeLark API Configuration:', {
  API_BASE_URL,
  API_KEY: API_KEY ? '***' + API_KEY.slice(-4) : 'NOT SET',
  APP_ID: APP_ID || 'NOT SET'
})

// Use the same UUID generator as the working endpoint
function generateUUID(): string {
  return 'yxxyxxxxyxyxxyxxyxxxyxxxyxxyxxyx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  }).toUpperCase()
}

interface GeeLarkResponse<T> {
  code: number
  msg: string
  data: T
}

interface CreateProfileData {
  totalAmount: number
  successAmount: number
  failAmount: number
  details: Array<{
    index: number
    code: number
    msg: string
    id: string
    profileName: string
    envSerialNo: string
    equipmentInfo: {
      countryName: string
      phoneNumber: string
      enableSim: number
      imei: string
      osVersion: string
      wifiBssid: string
      mac: string
      bluetoothMac: string
      timeZone: string
      deviceBrand?: string
      deviceModel?: string
    }
  }>
}

interface TaskData {
  task_id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  result?: any
}

interface ProfileStatus {
  online: boolean
  battery: number
  last_heartbeat: string
}

export class GeeLarkAPI {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const timestamp = Date.now().toString()
    const traceId = generateUUID()
    const nonce = traceId.substring(0, 6)
    const sign = createHash('sha256')
      .update(APP_ID + traceId + timestamp + nonce + API_KEY)
      .digest('hex')
      .toUpperCase()

    const headers = {
      'Content-Type': 'application/json',
      'appId': APP_ID,
      'traceId': traceId,
      'ts': timestamp,
      'nonce': nonce,
      'sign': sign,
      ...options.headers
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    })

    const data = await response.json() as GeeLarkResponse<T>

    if (data.code !== 0) {
      // Log error to Supabase
      await supabaseAdmin.from('logs').insert({
        level: 'error',
        component: 'geelark-api',
        message: `GeeLark API error: ${data.msg}`,
        meta: { 
          endpoint, 
          code: data.code, 
          msg: data.msg,
          trace_id: traceId
        }
      })
      
      throw new Error(`GeeLark API error: ${data.msg} (code: ${data.code})`)
    }

    return data.data
  }

  getHeaders(): Record<string, string> {
    const timestamp = Date.now().toString()
    const traceId = generateUUID()
    const nonce = traceId.substring(0, 6)
    const sign = createHash('sha256')
      .update(APP_ID + traceId + timestamp + nonce + API_KEY)
      .digest('hex')
      .toUpperCase()

    return {
      'Content-Type': 'application/json',
      'appId': APP_ID,
      'traceId': traceId,
      'ts': timestamp,
      'nonce': nonce,
      'sign': sign
    }
  }

  async createProfile(deviceInfo?: {
    amount?: number  // Add amount parameter for batch creation
    androidVersion?: number
    proxyId?: string  // Add support for GeeLark proxy ID
    proxyConfig?: {
      typeId: number
      server: string
      port: number
      username?: string
      password?: string
    }
    groupName?: string
    tagsName?: string[]
    remark?: string
    region?: string
    chargeMode?: number
    language?: string
    surfaceBrandName?: string
    surfaceModelName?: string
  }): Promise<CreateProfileData> {
    // Android version mapping
    const androidVersionMap: { [key: string]: number } = {
      '10': 1,
      '11': 2,
      '12': 3,
      '13': 4,
      '14': 7,
      '15': 8
    }

    const androidVersion = deviceInfo?.androidVersion || androidVersionMap['13'] || 4

    const requestBody: any = {
      amount: deviceInfo?.amount || 1, // Support batch creation, default to 1
      androidVersion: androidVersion,
      groupName: deviceInfo?.groupName || 'ungrouped',
      tagsName: deviceInfo?.tagsName || [],
      remark: deviceInfo?.remark || '',
      region: deviceInfo?.region || 'us', // Default to US
      chargeMode: deviceInfo?.chargeMode || 0, // Default to pay per minute
      language: deviceInfo?.language || 'default'
    }

    // Add proxy ID if provided (takes precedence over proxy config)
    if (deviceInfo?.proxyId) {
      requestBody.proxyId = deviceInfo.proxyId
      console.log('Using GeeLark proxy ID:', deviceInfo.proxyId)
    } else if (deviceInfo?.proxyConfig) {
      // Add proxy configuration if provided
      requestBody.proxyConfig = deviceInfo.proxyConfig
      console.log('Proxy config being sent:', JSON.stringify(deviceInfo.proxyConfig, null, 2))
    }

    // Add surface brand and model if provided
    if (deviceInfo?.surfaceBrandName && deviceInfo?.surfaceModelName) {
      requestBody.surfaceBrandName = deviceInfo.surfaceBrandName
      requestBody.surfaceModelName = deviceInfo.surfaceModelName
    }

    // Log the request body for debugging
    console.log('GeeLark createProfile request body:', JSON.stringify(requestBody, null, 2))

    const data = await this.request<CreateProfileData>('/open/v1/phone/add', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    })

    console.log('GeeLark createProfile response:', JSON.stringify(data, null, 2))

    if (!data || !data.details) {
      console.error('Invalid response structure:', data)
      throw new Error('Invalid response from GeeLark API - missing details')
    }

    if (data.failAmount > 0) {
      const failedDetail = data.details.find(d => d.code !== 0)
      console.error('Profile creation failed:', failedDetail)
      throw new Error(`Failed to create profile: ${failedDetail?.msg || 'Unknown error'} (code: ${failedDetail?.code})`)
    }

    if (!data.details || data.details.length === 0) {
      console.error('No profile details in response:', data)
      throw new Error('No profile created - empty details array')
    }

    // For batch creation, log all successful profiles
    if (deviceInfo?.amount && deviceInfo.amount > 1) {
      console.log(`Batch creation successful: ${data.successAmount}/${deviceInfo.amount} profiles created`)
    }

    const successDetail = data.details[0]
    
    if (!successDetail || !successDetail.id) {
      console.error('Invalid success detail:', successDetail)
      throw new Error('Invalid profile detail - missing ID')
    }

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'geelark-api',
      message: deviceInfo?.amount && deviceInfo.amount > 1 ? 'Batch profiles created' : 'Profile created',
      meta: { 
        amount: deviceInfo?.amount || 1,
        success_amount: data.successAmount,
        fail_amount: data.failAmount,
        profile_ids: data.details.filter(d => d.code === 0).map(d => d.id),
        proxy_id: deviceInfo?.proxyId,
        has_proxy_config: !!deviceInfo?.proxyConfig
      }
    })

    return data
  }

  async deleteProfile(profileId: string): Promise<void> {
    await this.request(`/open/v1/phone/delete`, {
      method: 'POST',
      body: JSON.stringify({
        ids: [profileId]
      })
    })

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'geelark-api',
      message: 'Profile deleted',
      meta: { profile_id: profileId }
    })
  }

  async setProxy(profileId: string, proxy: {
    host: string
    port: number
    username?: string
    password?: string
  }): Promise<void> {
    // For now, we'll need to update the proxy when creating the profile
    // GeeLark doesn't seem to have a separate endpoint for updating proxy after creation
    await supabaseAdmin.from('logs').insert({
      level: 'warning',
      component: 'geelark-api',
      message: 'Proxy update after profile creation not supported - proxy must be set during profile creation',
      meta: { profile_id: profileId, proxy_host: proxy.host }
    })
  }

  // These methods are deprecated - use the TikTok-specific methods instead
  // async startWarmupTask - use startTikTokWarmup
  // async postVideo - use postTikTokVideo

  async getTaskStatus(taskId: string): Promise<TaskData> {
    // GeeLark doesn't have a single task status endpoint, need to use query endpoint
    const response = await this.queryTasks([taskId])
    
    if (response.items && response.items.length > 0) {
      const task = response.items[0]
      // Map GeeLark status to our TaskData format
      return {
        task_id: task.id,
        status: task.status === 3 ? 'completed' : 
                task.status === 4 ? 'failed' : 
                task.status === 7 ? 'cancelled' :
                task.status === 2 ? 'running' : 'pending',
        result: {
          geelark_status: task.status,  // Include the actual Geelark status code
          failCode: task.failCode,
          failDesc: task.failDesc,
          cost: task.cost
        }
      }
    }
    
    throw new Error(`Task ${taskId} not found`)
  }

  async queryTasks(taskIds: string[]): Promise<any> {
    console.log('[GeeLark] Querying tasks:', taskIds)
    
    const response = await this.request('/open/v1/task/query', {
      method: 'POST',
      body: JSON.stringify({
        ids: taskIds
      })
    })
    
    console.log('[GeeLark] Query tasks response:', JSON.stringify(response, null, 2))
    
    return response
  }

  async getProfileStatus(profileId: string): Promise<ProfileStatus> {
    // Use the phone status endpoint instead
    const data = await this.request<any>('/open/v1/phone/status', {
      method: 'POST',
      body: JSON.stringify({
        ids: [profileId]
      })
    })
    
    // Transform the response to match our ProfileStatus interface
    const phoneData = data.data?.[0] || {}
    return {
      online: phoneData.status === 'online' || phoneData.status === 1,
      battery: phoneData.battery || 0,
      last_heartbeat: new Date().toISOString()
    }
  }

  async updateProfileHeartbeat(profileId: string, status: ProfileStatus): Promise<void> {
    await supabaseAdmin
      .from('phones')
      .update({
        status: status.online ? 'online' : 'offline',
        battery: status.battery,
        last_heartbeat: status.last_heartbeat,
        updated_at: new Date().toISOString()
      })
      .eq('profile_id', profileId)
  }

  // Phone Management
  async startPhones(phoneIds: string[]): Promise<any> {
    const data = await this.request<any>('/open/v1/phone/start', {
      method: 'POST',
      body: JSON.stringify({
        ids: phoneIds
      })
    })

    // Log successful starts
    if (data.successDetails && data.successDetails.length > 0) {
      await supabaseAdmin.from('logs').insert({
        level: 'info',
        component: 'geelark-api',
        message: 'Phones started successfully',
        meta: { 
          phone_ids: data.successDetails.map((d: any) => d.id),
          urls: data.successDetails.map((d: any) => ({ id: d.id, url: d.url }))
        }
      })
    }

    // Log any failures
    if (data.failDetails && data.failDetails.length > 0) {
      await supabaseAdmin.from('logs').insert({
        level: 'error',
        component: 'geelark-api',
        message: 'Some phones failed to start',
        meta: { 
          failures: data.failDetails.map((d: any) => ({ 
            id: d.id, 
            code: d.code, 
            msg: d.msg 
          }))
        }
      })
    }

    return data
  }



  async stopPhones(phoneIds: string[]): Promise<any> {
    return await this.request('/open/v1/phone/stop', {
      method: 'POST',
      body: JSON.stringify({
        ids: phoneIds
      })
    })
  }

  async getPhoneStatus(phoneIds: string[]): Promise<any> {
    try {
      const response = await this.request('/open/v1/phone/status', {
        method: 'POST',
        body: JSON.stringify({
          ids: phoneIds
        })
      })
      
      // Log the response structure for debugging
      if (phoneIds.length === 1) {
        console.log(`Phone status response for ${phoneIds[0]}:`, JSON.stringify(response, null, 2))
      }
      
      return response
    } catch (error) {
      console.error(`Failed to get phone status for ${phoneIds.join(', ')}:`, error)
      throw error
    }
  }

  async takeScreenshot(phoneId: string): Promise<{ taskId: string }> {
    const data = await this.request<{ taskId: string }>('/open/v1/phone/screenShot', {
      method: 'POST',
      body: JSON.stringify({
        id: phoneId
      })
    })

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'geelark-api',
      message: 'Screenshot requested',
      meta: { phone_id: phoneId, task_id: data.taskId }
    })

    return data
  }

  async getScreenshotResult(taskId: string): Promise<{
    status: number
    downloadLink?: string
  }> {
    return await this.request('/open/v1/phone/screenShot/result', {
      method: 'POST',
      body: JSON.stringify({
        taskId: taskId
      })
    })
  }

  // TikTok App Management
  async getInstallableApps(profileId: string, searchName?: string): Promise<any> {
    const data = await this.request('/open/v1/app/installable/list', {
      method: 'POST',
      body: JSON.stringify({
        envId: profileId,
        name: searchName || '',
        page: 1,
        pageSize: 100
      })
    })

    return data
  }

  async installApp(profileId: string, appVersionId: string): Promise<void> {
    await this.request('/open/v1/app/install', {
      method: 'POST',
      body: JSON.stringify({
        envId: profileId,
        appVersionId: appVersionId
      })
    })

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'geelark-api',
      message: 'App installation initiated',
      meta: { profile_id: profileId, app_version_id: appVersionId }
    })
  }

  async uninstallApp(profileId: string, appPackage: string): Promise<void> {
    await this.request(`/open/v1/phone/${profileId}/app/uninstall`, {
      method: 'POST',
      body: JSON.stringify({
        package_name: appPackage
      })
    })
  }

  async getInstalledApps(profileId: string): Promise<any> {
    return await this.request('/open/v1/app/list', {
      method: 'POST',
      body: JSON.stringify({
        envId: profileId,
        page: 1,
        pageSize: 100
      })
    })
  }

  async startApp(profileId: string, packageName: string): Promise<void> {
    await this.request('/open/v1/app/start', {
      method: 'POST',
      body: JSON.stringify({
        envId: profileId,
        packageName: packageName
      })
    })

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'geelark-api',
      message: 'App started',
      meta: { profile_id: profileId, package_name: packageName }
    })
  }

  async isTikTokInstalled(profileId: string): Promise<boolean> {
    try {
      const response = await this.getInstalledApps(profileId)
      const tiktokPackageName = 'com.zhiliaoapp.musically'
      
      if (response.items && Array.isArray(response.items)) {
        return response.items.some((app: any) => 
          app.packageName === tiktokPackageName && app.installStatus === 1
        )
      }
      
      return false
    } catch (error) {
      console.error('Error checking TikTok installation:', error)
      return false
    }
  }

  // TikTok Automation
  async loginTikTok(profileId: string, account: string, password: string): Promise<{ taskId: string }> {
    console.log('Starting TikTok login:', { profileId, account: account.substring(0, 3) + '***' })
    
    const requestBody = {
      name: `tiktok_login_${Date.now()}`,
      remark: `Login for ${account}`,
      scheduleAt: Math.floor(Date.now() / 1000),
      id: profileId,
      account: account,
      password: password
    }
    
    console.log('TikTok login request (FULL DEBUG):', requestBody)
    
    const data = await this.request<{ taskId: string }>('/open/v1/rpa/task/tiktokLogin', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    })

    if (!data.taskId) {
      throw new Error('No task ID returned from login request')
    }

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'geelark-api',
      message: 'TikTok login initiated',
      meta: { 
        profile_id: profileId, 
        account: account, 
        task_id: data.taskId,
        password_length: password.length,
        password_first_char: password.charAt(0),
        password_last_char: password.charAt(password.length - 1)
      }
    })

    return data
  }

  async startTikTokWarmup(profileId: string, accountId: string, options?: {
    duration_minutes?: number
    action?: 'browse video' | 'search video' | 'search profile'
    keywords?: string[]
  }): Promise<string> {
    console.log('Starting TikTok warmup:', { profileId, accountId, options })
    
    const requestBody: {
      planName: string
      taskType: number
      list: Array<{
        scheduleAt: number
        envId: string
        action: string
        duration: number
        keywords?: string[]
      }>
    } = {
      planName: `warmup_${accountId}_${Date.now()}`,
      taskType: 2, // Warmup
      list: [{
        scheduleAt: Math.floor(Date.now() / 1000),
        envId: profileId,
        action: options?.action || 'browse video',
        duration: options?.duration_minutes || 30
      }]
    }
    
    // Add keywords only if provided and action requires them
    if (options?.keywords && options.keywords.length > 0 && options.action !== 'browse video') {
      requestBody.list[0].keywords = options.keywords
    }
    
    console.log('Warmup request body:', JSON.stringify(requestBody, null, 2))
    
    const data = await this.request<{ taskIds: string[] }>('/open/v1/task/add', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    })

    if (!data.taskIds || data.taskIds.length === 0) {
      throw new Error('No task ID returned from warmup request')
    }

    const taskId = data.taskIds[0]

    await supabaseAdmin.from('tasks').insert({
      type: 'warmup',
      task_type: 'warmup',  // Required field
      geelark_task_id: taskId,
      account_id: accountId,  // Use account_id instead of profile_id
      status: 'running',
      started_at: new Date().toISOString(),
      meta: {
        duration_minutes: options?.duration_minutes || 30,
        action: options?.action || 'browse video',
        profile_id: profileId  // Store profile_id in meta
      }
    })

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'geelark-api',
      message: 'TikTok warmup task created',
      meta: { 
        profile_id: profileId,
        task_id: taskId,
        duration: options?.duration_minutes || 30,
        action: options?.action || 'browse video'
      }
    })

    return taskId
  }

  async uploadFileFromUrl(sourceUrl: string, fileType: 'png' | 'jpg' | 'jpeg' | 'webp'): Promise<string> {
    try {
      // Get upload URL from Geelark
      const { uploadUrl, resourceUrl } = await this.getUploadUrl(fileType)

      // Fetch the file from source URL with timeout
      const controller = new AbortController()
      const downloadTimeout = setTimeout(() => controller.abort(), 30000) // 30 second timeout for download
      
      try {
        const response = await fetch(sourceUrl, { signal: controller.signal })
        clearTimeout(downloadTimeout)
        
        if (!response.ok) {
          throw new Error(`Failed to fetch file from ${sourceUrl}: ${response.status}`)
        }

        const fileBuffer = await response.arrayBuffer()
        
        // Check file size
        const fileSizeMB = fileBuffer.byteLength / (1024 * 1024)
        console.log(`[GeeLark] Image file size: ${fileSizeMB.toFixed(2)} MB`)
        
        if (fileSizeMB > 20) {
          throw new Error(`Image file too large: ${fileSizeMB.toFixed(2)} MB (max 20 MB)`)
        }

        // Upload to Geelark's storage with retry logic
        let uploadAttempts = 0
        const maxUploadAttempts = 3
        let lastError: Error | null = null

        while (uploadAttempts < maxUploadAttempts) {
          uploadAttempts++
          console.log(`[GeeLark] Upload attempt ${uploadAttempts}/${maxUploadAttempts}`)
          
          const uploadController = new AbortController()
          const uploadTimeoutMs = 30000 // 30 second timeout for images
          const uploadTimeout = setTimeout(() => uploadController.abort(), uploadTimeoutMs)
          
          try {
            const uploadResponse = await fetch(uploadUrl, {
              method: 'PUT',
              body: fileBuffer,
              signal: uploadController.signal
              // DO NOT add any headers - Geelark documentation specifically says no extra headers
            })
            clearTimeout(uploadTimeout)

            if (!uploadResponse.ok) {
              throw new Error(`Failed to upload file to Geelark: ${uploadResponse.status}`)
            }

            // Success - log and return
            await supabaseAdmin.from('logs').insert({
              level: 'info',
              component: 'geelark-api',
              message: 'File uploaded to Geelark',
              meta: { 
                sourceUrl, 
                resourceUrl, 
                fileType,
                fileSizeMB: fileSizeMB.toFixed(2),
                attempts: uploadAttempts
              }
            })

            return resourceUrl
          } catch (uploadError) {
            lastError = uploadError as Error
            clearTimeout(uploadTimeout)
            
            if (uploadError instanceof Error && uploadError.name === 'AbortError') {
              console.error(`[GeeLark] Upload timeout on attempt ${uploadAttempts}`)
              lastError = new Error(`Upload timeout after ${uploadTimeoutMs / 1000} seconds`)
            } else {
              console.error(`[GeeLark] Upload error on attempt ${uploadAttempts}:`, uploadError)
            }
            
            // Wait before retry (exponential backoff)
            if (uploadAttempts < maxUploadAttempts) {
              const waitTime = uploadAttempts * 2000 // 2s, 4s
              console.log(`[GeeLark] Waiting ${waitTime}ms before retry...`)
              await new Promise(resolve => setTimeout(resolve, waitTime))
            }
          }
        }

        // All attempts failed
        throw new Error(`Failed to upload file after ${maxUploadAttempts} attempts: ${lastError?.message || 'Unknown error'}`)
        
      } catch (downloadError) {
        clearTimeout(downloadTimeout)
        if (downloadError instanceof Error && downloadError.name === 'AbortError') {
          throw new Error('File download timeout after 30 seconds')
        }
        throw downloadError
      }
    } catch (error) {
      await supabaseAdmin.from('logs').insert({
        level: 'error',
        component: 'geelark-api',
        message: 'Failed to upload file to Geelark',
        meta: { sourceUrl, error: String(error) }
      })
      throw error
    }
  }

  async uploadVideoFromUrl(sourceUrl: string): Promise<string> {
    try {
      // Determine file type from URL
      const fileExtension = sourceUrl.split('.').pop()?.toLowerCase()
      const supportedTypes = ['mp4', 'webm', 'mov']
      const fileType = supportedTypes.includes(fileExtension || '') ? fileExtension : 'mp4'

      // Get upload URL from Geelark
      const { uploadUrl, resourceUrl } = await this.getUploadUrl(fileType as any)

      // Fetch the file from source URL with timeout
      const controller = new AbortController()
      const downloadTimeout = setTimeout(() => controller.abort(), 60000) // 60 second timeout for download
      
      try {
        const response = await fetch(sourceUrl, { signal: controller.signal })
        clearTimeout(downloadTimeout)
        
        if (!response.ok) {
          throw new Error(`Failed to fetch video from ${sourceUrl}: ${response.status}`)
        }

        const fileBuffer = await response.arrayBuffer()
        
        // Check file size
        const fileSizeMB = fileBuffer.byteLength / (1024 * 1024)
        console.log(`[GeeLark] Video file size: ${fileSizeMB.toFixed(2)} MB`)
        
        if (fileSizeMB > 100) {
          throw new Error(`Video file too large: ${fileSizeMB.toFixed(2)} MB (max 100 MB)`)
        }

        // Upload to Geelark's storage with retry logic
        let uploadAttempts = 0
        const maxUploadAttempts = 3
        let lastError: Error | null = null

        while (uploadAttempts < maxUploadAttempts) {
          uploadAttempts++
          console.log(`[GeeLark] Upload attempt ${uploadAttempts}/${maxUploadAttempts}`)
          
          const uploadController = new AbortController()
          // Increase timeout based on file size (minimum 30 seconds, +1 second per MB)
          const uploadTimeoutMs = Math.max(30000, 30000 + (fileSizeMB * 1000))
          const uploadTimeout = setTimeout(() => uploadController.abort(), uploadTimeoutMs)
          
          try {
            const uploadResponse = await fetch(uploadUrl, {
              method: 'PUT',
              body: fileBuffer,
              signal: uploadController.signal
              // DO NOT add any headers - Geelark documentation specifically says no extra headers
            })
            clearTimeout(uploadTimeout)

            if (!uploadResponse.ok) {
              throw new Error(`Failed to upload video to Geelark: ${uploadResponse.status}`)
            }

            // Success - log and return
            await supabaseAdmin.from('logs').insert({
              level: 'info',
              component: 'geelark-api',
              message: 'Video uploaded to Geelark',
              meta: { 
                sourceUrl, 
                resourceUrl, 
                fileType,
                fileSizeMB: fileSizeMB.toFixed(2),
                attempts: uploadAttempts
              }
            })

            return resourceUrl
          } catch (uploadError) {
            lastError = uploadError as Error
            clearTimeout(uploadTimeout)
            
            if (uploadError instanceof Error && uploadError.name === 'AbortError') {
              console.error(`[GeeLark] Upload timeout on attempt ${uploadAttempts}`)
              lastError = new Error(`Upload timeout after ${uploadTimeoutMs / 1000} seconds`)
            } else {
              console.error(`[GeeLark] Upload error on attempt ${uploadAttempts}:`, uploadError)
            }
            
            // Wait before retry (exponential backoff)
            if (uploadAttempts < maxUploadAttempts) {
              const waitTime = uploadAttempts * 2000 // 2s, 4s
              console.log(`[GeeLark] Waiting ${waitTime}ms before retry...`)
              await new Promise(resolve => setTimeout(resolve, waitTime))
            }
          }
        }

        // All attempts failed
        throw new Error(`Failed to upload video after ${maxUploadAttempts} attempts: ${lastError?.message || 'Unknown error'}`)
        
      } catch (downloadError) {
        clearTimeout(downloadTimeout)
        if (downloadError instanceof Error && downloadError.name === 'AbortError') {
          throw new Error('Video download timeout after 60 seconds')
        }
        throw downloadError
      }
    } catch (error) {
      await supabaseAdmin.from('logs').insert({
        level: 'error',
        component: 'geelark-api',
        message: 'Failed to upload video to Geelark',
        meta: { sourceUrl, error: String(error) }
      })
      throw error
    }
  }

  async uploadCarouselImages(imageUrls: string[]): Promise<string[]> {
    const uploadedUrls: string[] = []
    
    for (const imageUrl of imageUrls) {
      try {
        // Determine file type from URL
        const fileExtension = imageUrl.split('.').pop()?.toLowerCase()
        const supportedTypes = ['png', 'jpg', 'jpeg', 'webp']
        const fileType = supportedTypes.includes(fileExtension || '') ? fileExtension : 'jpg'
        
        const geelarkUrl = await this.uploadFileFromUrl(imageUrl, fileType as any)
        uploadedUrls.push(geelarkUrl)
      } catch (error) {
        console.error(`Failed to upload carousel image ${imageUrl}:`, error)
        // Continue with other images even if one fails
      }
    }

    if (uploadedUrls.length === 0) {
      throw new Error('Failed to upload any carousel images')
    }

    return uploadedUrls
  }

  async postTikTokCarousel(profileId: string, accountId: string, content: {
    images: string[]
    caption: string
    hashtags?: string[]
    music?: string
  }): Promise<string> {
    let phoneStarted = false
    
    try {
      // Step 1: Start the phone
      console.log('[GeeLark] Starting phone for carousel post...')
      await this.startPhones([profileId])
      phoneStarted = true
      
      // Wait for phone to be ready using the proper utility
      await waitForPhoneReady(profileId, {
        maxAttempts: 300, // 10 minutes max (300 * 2s)
        logProgress: true,
        logPrefix: '[Carousel Post] '
      })
      console.log('[GeeLark] Phone started and ready')

      // Step 2: Upload images to Geelark temporary storage first
      console.log('[GeeLark] Uploading carousel images to Geelark temporary storage...')
      const geelarkImageUrls = await this.uploadCarouselImages(content.images)
      console.log(`[GeeLark] Uploaded ${geelarkImageUrls.length} images to Geelark`)

      // Step 3: Upload each image to the phone's Downloads folder
      console.log('[GeeLark] Uploading images to phone Downloads folder...')
      for (let i = 0; i < geelarkImageUrls.length; i++) {
        const uploadTaskId = await this.uploadFileToPhone(profileId, geelarkImageUrls[i])
        await this.waitForUpload(uploadTaskId)
        console.log(`[GeeLark] Image ${i + 1}/${geelarkImageUrls.length} uploaded to phone`)
      }

      // Step 4: Create the carousel posting task
      const scheduleAt = Math.floor(Date.now() / 1000) + 60

      const requestBody = {
        planName: `carousel_${accountId}_${Date.now()}`,
        taskType: 3, // Publish image set
        list: [{
          scheduleAt: scheduleAt,
          envId: profileId,
          images: geelarkImageUrls, // Array of image URLs as per documentation
          videoDesc: content.caption + (content.hashtags ? ' ' + content.hashtags.join(' ') : ''),
          videoTitle: content.caption.substring(0, 50),
          maxTryTimes: 3,
          timeoutMin: 50,
          sameVideoVolume: 50,
          sourceVideoVolume: 50
        }]
      }

      console.log('[GeeLark] Creating carousel post task...')
      const data = await this.request<{ taskIds: string[] }>('/open/v1/task/add', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      const taskId = data.taskIds[0]
      console.log('[GeeLark] Carousel post task created with ID:', taskId)

      await supabaseAdmin.from('tasks').insert({
        type: 'post',
        task_type: 'post',
        geelark_task_id: taskId,
        account_id: accountId,
        status: 'running',
        started_at: new Date().toISOString(),
        meta: { 
          type: 'carousel', 
          images_count: content.images.length,
          original_images: content.images,
          geelark_images: geelarkImageUrls,
          scheduled_at: new Date(scheduleAt * 1000).toISOString(),
          phone_started: true
        }
      })

      // Start monitoring task completion and auto-stop phone (non-blocking)
      monitorPostCompletionAndStop(accountId, profileId, taskId, 'carousel').catch(error => {
        console.error('[GeeLark] Error in post completion monitor:', error)
      })

      return taskId
      
    } catch (error) {
      // If phone was started but task failed, we should stop it
      if (phoneStarted) {
        try {
          await this.stopPhones([profileId])
        } catch (stopError) {
          console.error('[GeeLark] Failed to stop phone after error:', stopError)
        }
      }
      throw error
    }
  }

  async postTikTokVideo(profileId: string, accountId: string, content: {
    video_url: string
    caption: string
    hashtags?: string[]
    music?: string
  }): Promise<string> {
    let phoneStarted = false
    
    try {
      // Step 1: Start the phone
      console.log('[GeeLark] Starting phone for video post...')
      await this.startPhones([profileId])
      phoneStarted = true
      
      // Wait for phone to be ready using the proper utility
      await waitForPhoneReady(profileId, {
        maxAttempts: 300, // 10 minutes max (300 * 2s)
        logProgress: true,
        logPrefix: '[Video Post] '
      })
      console.log('[GeeLark] Phone started and ready')

      // Step 2: Upload video to Geelark temporary storage first
      console.log('[GeeLark] Uploading video to Geelark temporary storage...')
      const geelarkVideoUrl = await this.uploadVideoFromUrl(content.video_url)
      console.log('[GeeLark] Video uploaded to Geelark:', geelarkVideoUrl)

      // Step 3: Upload the video to the phone's Downloads folder
      console.log('[GeeLark] Uploading video to phone Downloads folder...')
      const uploadTaskId = await this.uploadFileToPhone(profileId, geelarkVideoUrl)
      await this.waitForUpload(uploadTaskId)
      console.log('[GeeLark] Video uploaded to phone successfully')

      // Step 4: Create the video posting task
      const scheduleAt = Math.floor(Date.now() / 1000) + 60

      const requestBody = {
        planName: `video_${accountId}_${Date.now()}`,
        taskType: 1, // Publish video
        list: [{
          scheduleAt: scheduleAt,
          envId: profileId,
          video: geelarkVideoUrl, // Use the Geelark URL
          videoDesc: content.caption + (content.hashtags ? ' ' + content.hashtags.join(' ') : ''),
          maxTryTimes: 3,
          timeoutMin: 60,
          sameVideoVolume: 50,
          sourceVideoVolume: 50
        }]
      }

      console.log('[GeeLark] Creating video post task...')
      const data = await this.request<{ taskIds: string[] }>('/open/v1/task/add', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      const taskId = data.taskIds[0]
      console.log('[GeeLark] Video post task created with ID:', taskId)

      await supabaseAdmin.from('tasks').insert({
        type: 'post',
        task_type: 'post',
        geelark_task_id: taskId,
        account_id: accountId,
        status: 'running',
        started_at: new Date().toISOString(),
        meta: { 
          type: 'video',
          original_video: content.video_url,
          geelark_video: geelarkVideoUrl,
          scheduled_at: new Date(scheduleAt * 1000).toISOString(),
          phone_started: true
        }
      })

      // Start monitoring task completion and auto-stop phone (non-blocking)
      monitorPostCompletionAndStop(accountId, profileId, taskId, 'video').catch(error => {
        console.error('[GeeLark] Error in post completion monitor:', error)
      })

      return taskId
      
    } catch (error) {
      // If phone was started but task failed, we should stop it
      if (phoneStarted) {
        try {
          await this.stopPhones([profileId])
        } catch (stopError) {
          console.error('[GeeLark] Failed to stop phone after error:', stopError)
        }
      }
      throw error
    }
  }

  async editTikTokProfile(profileId: string, profile: {
    avatar?: string
    nickName?: string
    bio?: string
    site?: string
  }): Promise<{ taskId: string }> {
    let phoneStarted = false
    let geelarkAvatarUrl: string | undefined
    
    try {
      // Step 1: Start the phone
      console.log('[GeeLark] Starting phone for profile edit...')
      await this.startPhones([profileId])
      phoneStarted = true
      
      // Wait for phone to be ready using the proper utility
      await waitForPhoneReady(profileId, {
        maxAttempts: 300, // 10 minutes max (300 * 2s)
        logProgress: true,
        logPrefix: '[Profile Edit] '
      })
      console.log('[GeeLark] Phone started and ready')

      // Step 2: If avatar is provided, upload it
      if (profile.avatar) {
        // Upload to Geelark temporary storage first
        console.log('[GeeLark] Uploading avatar to Geelark temporary storage...')
        const fileExtension = profile.avatar.split('.').pop()?.toLowerCase()
        const supportedTypes = ['png', 'jpg', 'jpeg', 'webp']
        const fileType = supportedTypes.includes(fileExtension || '') ? fileExtension : 'jpg'
        
        geelarkAvatarUrl = await this.uploadFileFromUrl(profile.avatar, fileType as any)
        console.log('[GeeLark] Avatar uploaded to Geelark:', geelarkAvatarUrl)

        // Upload to phone's Downloads folder
        console.log('[GeeLark] Uploading avatar to phone Downloads folder...')
        const uploadTaskId = await this.uploadFileToPhone(profileId, geelarkAvatarUrl)
        await this.waitForUpload(uploadTaskId)
        console.log('[GeeLark] Avatar uploaded to phone successfully')
      }

      // Step 3: Create the profile edit task
      const requestBody = {
        name: `profile_edit_${Date.now()}`,
        remark: `Edit profile: ${profile.nickName || 'update'}`,
        scheduleAt: Math.floor(Date.now() / 1000) + 60, // Schedule 1 minute from now
        id: profileId,
        ...(profile.nickName && { nickName: profile.nickName }),
        ...(profile.bio && { bio: profile.bio }),
        ...(profile.site && { site: profile.site }),
        ...(geelarkAvatarUrl && { avatar: geelarkAvatarUrl })
      }

      console.log('[GeeLark] Creating profile edit task...')
      const data = await this.request<{ taskId: string }>('/open/v1/rpa/task/tiktokEdit', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      await supabaseAdmin.from('logs').insert({
        level: 'info',
        component: 'geelark-api',
        message: 'TikTok profile edit initiated',
        meta: { 
          profile_id: profileId, 
          task_id: data.taskId, 
          changes: profile,
          geelark_avatar: geelarkAvatarUrl,
          phone_started: true
        }
      })

      // Start monitoring task completion and auto-stop phone (non-blocking)
      // Note: Profile edit tasks don't have an accountId, so we'll use profileId as fallback
      monitorPostCompletionAndStop(profileId, profileId, data.taskId, 'profile_edit').catch(error => {
        console.error('[GeeLark] Error in profile edit completion monitor:', error)
      })

      return data
      
    } catch (error) {
      // If phone was started but task failed, we should stop it
      if (phoneStarted) {
        try {
          await this.stopPhones([profileId])
        } catch (stopError) {
          console.error('[GeeLark] Failed to stop phone after error:', stopError)
        }
      }
      throw error
    }
  }

  async cancelTasks(taskIds: string[]): Promise<any> {
    return await this.request('/open/v1/task/cancel', {
      method: 'POST',
      body: JSON.stringify({
        ids: taskIds
      })
    })
  }

  async retryTasks(taskIds: string[]): Promise<any> {
    return await this.request('/open/v1/task/restart', {
      method: 'POST',
      body: JSON.stringify({
        ids: taskIds
      })
    })
  }

  async uploadFilesToPhone(profileId: string, files: string[]): Promise<{ taskId: string }> {
    const data = await this.request<{ taskId: string }>('/open/v1/rpa/task/fileUpload', {
      method: 'POST',
      body: JSON.stringify({
        scheduleAt: Math.floor(Date.now() / 1000),
        id: profileId,
        files: files
      })
    })

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'geelark-api',
      message: 'Files upload initiated',
      meta: { profile_id: profileId, task_id: data.taskId, files_count: files.length }
    })

    return data
  }

  // Proxy Management
  async addProxies(proxies: Array<{
    scheme: 'socks5' | 'http' | 'https'
    server: string
    port: number
    username?: string
    password?: string
  }>): Promise<{
    totalAmount: number
    successAmount: number
    failAmount: number
    failDetails: Array<{
      index: number
      code: number
      msg: string
    }>
    successDetails: Array<{
      index: number
      id: string
    }>
  }> {
    const data = await this.request<any>('/open/v1/proxy/add', {
      method: 'POST',
      body: JSON.stringify({
        list: proxies
      })
    })

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'geelark-api',
      message: 'Proxies added to GeeLark',
      meta: { 
        total: data.totalAmount,
        success: data.successAmount,
        failed: data.failAmount,
        details: data
      }
    })

    return data
  }

  async listProxies(page: number = 1, pageSize: number = 100, ids?: string[]): Promise<{
    total: number
    page: number
    pageSize: number
    list: Array<{
      id: string
      scheme: string
      server: string
      port: number
      username: string
      password: string
    }>
  }> {
    const requestBody: any = {
      page,
      pageSize
    }

    if (ids && ids.length > 0) {
      requestBody.ids = ids
    }

    return await this.request('/open/v1/proxy/list', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    })
  }

  // Profile Management
  async getProfileList(): Promise<any[]> {
    try {
      const response = await this.request<any>('/open/v1/phone/list', {
        method: 'POST',
        body: JSON.stringify({
          page: 1,
          pageSize: 100
        })
      })
      
      return response.data?.items || []
    } catch (error) {
      console.error('Failed to get profile list:', error)
      return []
    }
  }

  async getPhoneList(phoneIds: string[]): Promise<any> {
    return await this.request('/open/v1/phone/list', {
      method: 'POST',
      body: JSON.stringify({
        ids: phoneIds,
        page: 1,
        pageSize: 100
      })
    })
  }

  // ADB Management
  async enableADB(deviceIds: string[]): Promise<void> {
    await this.request('/open/v1/adb/setStatus', {
      method: 'POST',
      body: JSON.stringify({
        ids: deviceIds,
        open: true
      })
    })

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'geelark-api',
      message: 'ADB enabled for devices',
      meta: { device_ids: deviceIds }
    })
  }

  async disableADB(deviceIds: string[]): Promise<void> {
    await this.request('/open/v1/adb/setStatus', {
      method: 'POST',
      body: JSON.stringify({
        ids: deviceIds,
        open: false
      })
    })

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'geelark-api',
      message: 'ADB disabled for devices',
      meta: { device_ids: deviceIds }
    })
  }

  async getADBInfo(deviceIds: string[]): Promise<{
    items: Array<{
      code: number
      id: string
      ip: string
      port: string
      pwd: string
    }>
  }> {
    const data = await this.request<any>('/open/v1/adb/getData', {
      method: 'POST',
      body: JSON.stringify({
        ids: deviceIds
      })
    })

    // Log successful ADB info retrieval
    const successfulDevices = data.items.filter((item: any) => item.code === 0)
    if (successfulDevices.length > 0) {
      await supabaseAdmin.from('logs').insert({
        level: 'info',
        component: 'geelark-api',
        message: 'ADB info retrieved successfully',
        meta: { 
          device_count: successfulDevices.length,
          devices: successfulDevices.map((d: any) => ({ id: d.id, ip: d.ip, port: d.port }))
        }
      })
    }

    // Log any errors
    const failedDevices = data.items.filter((item: any) => item.code !== 0)
    if (failedDevices.length > 0) {
      await supabaseAdmin.from('logs').insert({
        level: 'warning',
        component: 'geelark-api',
        message: 'Some devices failed to provide ADB info',
        meta: { 
          failed_devices: failedDevices.map((d: any) => ({ 
            id: d.id, 
            code: d.code,
            error: d.code === 42001 ? 'Cloud phone does not exist' :
                   d.code === 42002 ? 'Cloud phone is not running' :
                   d.code === 49001 ? 'ADB is not enabled' :
                   d.code === 49002 ? 'Device does not support ADB' : 'Unknown error'
          }))
        }
      })
    }

    return data
  }

  // Custom RPA Task Management
  async getTaskFlows(page: number = 1, pageSize: number = 100): Promise<{
    total: number
    items: Array<{
      id: string
      title: string
      desc: string
      params: string[]
    }>
  }> {
    const data = await this.request<any>('/open/v1/task/flow/list', {
      method: 'POST',
      body: JSON.stringify({
        page,
        pageSize
      })
    })

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'geelark-api',
      message: 'Task flows retrieved',
      meta: { 
        total: data.total,
        flows: data.items
      }
    })

    return data
  }

  async createCustomRPATask(
    profileId: string,
    flowId: string,
    params: Record<string, any>,
    options?: {
      name?: string
      remark?: string
    }
  ): Promise<{ taskId: string }> {
    const data = await this.request<{ taskId: string }>('/open/v1/task/rpa/add', {
      method: 'POST',
      body: JSON.stringify({
        name: options?.name || `custom_rpa_${Date.now()}`,
        remark: options?.remark || 'Custom RPA task',
        scheduleAt: Math.floor(Date.now() / 1000),
        id: profileId,
        flowId: flowId,
        paramMap: params
      })
    })

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'geelark-api',
      message: 'Custom RPA task created',
      meta: { 
        profile_id: profileId,
        flow_id: flowId,
        task_id: data.taskId,
        params
      }
    })

    return data
  }

  // Phone-based TikTok login using custom RPA
  async loginTikTokWithPhone(
    profileId: string,
    phoneNumber: string,
    flowId: string
  ): Promise<{ taskId: string }> {
    // The task flow will fetch the phone number using the accountId
    // We don't need to pass phoneNumber as a parameter
    
    // Get the account ID from the profile
    const { data: account } = await supabaseAdmin
      .from('accounts')
      .select('id')
      .eq('geelark_profile_id', profileId)
      .single()
    
    if (!account) {
      throw new Error('Account not found for profile')
    }
    
    const data = await this.createCustomRPATask(
      profileId,
      flowId,
      {
        accountId: account.id  // Pass the account ID for the task flow to fetch phone number
      },
      {
        name: `tiktok_phone_login_${Date.now()}`,
        remark: `Phone login for account ${account.id}`
      }
    )

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'geelark-api',
      message: 'TikTok phone login RPA task initiated',
      meta: { 
        profile_id: profileId,
        account_id: account.id,
        task_id: data.taskId,
        flow_id: flowId
      }
    })

    return data
  }

  // Create TikTok phone login task with account ID
  async createTikTokPhoneLoginTask(
    profileId: string,
    accountId: string,
    flowId: string
  ): Promise<{ taskId: string }> {
    const data = await this.createCustomRPATask(
      profileId,
      flowId,
      {
        accountId: accountId  // Pass the account ID for the task flow to fetch phone number
      },
      {
        name: `tiktok_phone_login_${Date.now()}`,
        remark: `Phone login for account ${accountId}`
      }
    )

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'geelark-api',
      message: 'TikTok phone login RPA task created',
      meta: { 
        profile_id: profileId,
        account_id: accountId,
        task_id: data.taskId,
        flow_id: flowId
      }
    })

    return data
  }

  // Update RPA task with OTP
  async updateRPATaskWithOTP(
    profileId: string,
    flowId: string,
    phoneNumber: string,
    otpCode: string,
    accountId: string,
    username: string,
    password: string
  ): Promise<{ taskId: string }> {
    const formattedPhone = phoneNumber.startsWith('1') ? phoneNumber.substring(1) : phoneNumber
    
    const data = await this.createCustomRPATask(
      profileId,
      flowId,
      {
        accountId: accountId,
        username: username,
        password: password,
        phoneNumber: formattedPhone,
        otpCode: otpCode
      },
      {
        name: `tiktok_otp_entry_${Date.now()}`,
        remark: `OTP entry for ${formattedPhone}`
      }
    )

    return data
  }

  // File Upload Management
  async getUploadUrl(fileType: 'mp4' | 'webm' | 'mov' | 'png' | 'jpg' | 'jpeg' | 'webp'): Promise<{
    uploadUrl: string
    resourceUrl: string
  }> {
    const data = await this.request<{
      uploadUrl: string
      resourceUrl: string
    }>('/open/v1/upload/getUrl', {
      method: 'POST',
      body: JSON.stringify({ fileType })
    })

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'geelark-api',
      message: 'Upload URL generated',
      meta: { fileType, resourceUrl: data.resourceUrl }
    })

    return data
  }

  async uploadFileToPhone(phoneId: string, fileUrl: string): Promise<string> {
    const data = await this.request<{ taskId: string }>('/open/v1/phone/uploadFile', {
      method: 'POST',
      body: JSON.stringify({
        id: phoneId,
        fileUrl: fileUrl
      })
    })

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'geelark-api',
      message: 'File upload to phone initiated',
      meta: { phone_id: phoneId, file_url: fileUrl, task_id: data.taskId }
    })

    return data.taskId
  }

  async checkUploadStatus(taskId: string): Promise<number> {
    const data = await this.request<{ status: number }>('/open/v1/phone/uploadFile/result', {
      method: 'POST',
      body: JSON.stringify({
        taskId: taskId
      })
    })

    // Status: 0: Failed to retrieve; 1: Uploading; 2: Upload successful; 3: Upload failed
    return data.status
  }

  async waitForUpload(taskId: string): Promise<void> {
    console.log(`[GeeLark] Waiting for upload ${taskId} to complete...`)
    
    while (true) {
      const status = await this.checkUploadStatus(taskId)
      
      if (status === 2) {
        // Upload successful
        console.log(`[GeeLark] Upload ${taskId} completed successfully`)
        return
      } else if (status === 3 || status === 0) {
        // Upload failed or failed to retrieve
        throw new Error(`File upload failed with status: ${status}`)
      }
      
      // Still uploading, wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  async executeTaskWithFullWorkflow(
    phoneId: string,
    taskCreator: () => Promise<string>,
    options?: {
      waitForCompletion?: boolean
    }
  ): Promise<string> {
    let phoneStarted = false
    let taskId: string | undefined
    
    try {
      // Start the phone
      console.log('[GeeLark] Starting phone for task execution...')
      await this.startPhones([phoneId])
      phoneStarted = true
      
      // Wait for phone to be ready using the proper utility
      await waitForPhoneReady(phoneId, {
        maxAttempts: 300, // 10 minutes max (300 * 2s)
        logProgress: true,
        logPrefix: '[Task Execution] '
      })
      console.log('[GeeLark] Phone started and ready')

      // Execute the task creator
      taskId = await taskCreator()
      
      // If requested, wait for task completion
      if (options?.waitForCompletion && taskId) {
        await this.waitForTaskCompletion(taskId, phoneId)
      }
      
      return taskId
      
    } catch (error) {
      // If phone was started but task failed, stop it
      if (phoneStarted && !options?.waitForCompletion) {
        try {
          await this.stopPhones([phoneId])
        } catch (stopError) {
          console.error('[GeeLark] Failed to stop phone after error:', stopError)
        }
      }
      throw error
    }
  }

  async waitForTaskCompletion(taskId: string, phoneId: string): Promise<void> {
    console.log(`[GeeLark] Waiting for task ${taskId} to complete...`)
    
    try {
      while (true) {
        const tasks = await this.queryTasks([taskId])
        
        if (tasks.items && tasks.items.length > 0) {
          const task = tasks.items[0]
          
          if (task.status === 3) {
            // Task completed successfully
            console.log('[GeeLark] Task completed successfully')
            return
          } else if (task.status === 4 || task.status === 7) {
            // Task failed or cancelled
            throw new Error(`Task failed with status ${task.status}: ${task.failDesc || 'Unknown error'}`)
          }
        }
        
        // Still running, wait 5 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
    } finally {
      // Always try to stop the phone
      try {
        console.log('[GeeLark] Stopping phone after task...')
        await this.stopPhones([phoneId])
        console.log('[GeeLark] Phone stopped successfully')
      } catch (error) {
        console.error('[GeeLark] Failed to stop phone:', error)
      }
    }
  }

  async updatePhoneDetails(phoneId: string, details: {
    name?: string
    remark?: string
    tagIDs?: string[]
    tagsName?: string[]
  }): Promise<void> {
    // Build request body – GeeLark only documents tagIDs, but if tagsName is provided we include it as well.
    const body: Record<string, any> = {
      id: phoneId,
    }
    if (details.name !== undefined) body.name = details.name
    if (details.remark !== undefined) body.remark = details.remark
    if (details.tagIDs !== undefined) body.tagIDs = details.tagIDs
    if (details.tagsName !== undefined) body.tagsName = details.tagsName

    console.log('[GeeLark] updatePhoneDetails payload:', JSON.stringify(body, null, 2))

    await this.request('/open/v1/phone/detail/update', {
      method: 'POST',
      body: JSON.stringify(body)
    })

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'geelark-api',
      message: 'Phone details updated',
      meta: {
        phone_id: phoneId,
        fields_updated: Object.keys(details)
      }
    })
  }
}

export const geelarkApi = new GeeLarkAPI()