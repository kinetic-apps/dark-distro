import { supabaseAdmin } from './supabase/admin'
import { createHash } from 'crypto'

const API_BASE_URL = (process.env.GEELARK_API_BASE_URL || 'https://openapi.geelark.com').replace(/\/$/, '')
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
    const url = `${API_BASE_URL}${endpoint}`
    
    // Generate required headers for signature verification - matching working implementation
    const timestamp = new Date().getTime().toString()
    const traceId = generateUUID()
    const nonce = traceId.substring(0, 6)
    
    // Generate signature: SHA256(appId + traceId + ts + nonce + apiKey)
    const signString = APP_ID + traceId + timestamp + nonce + API_KEY
    const sign = createHash('sha256').update(signString).digest('hex').toUpperCase()
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'appId': APP_ID,
          'traceId': traceId,
          'ts': timestamp,
          'nonce': nonce,
          'sign': sign,
          ...options.headers,
        },
      })

      const responseText = await response.text()
      let data: GeeLarkResponse<T>
      
      try {
        data = JSON.parse(responseText) as GeeLarkResponse<T>
      } catch (parseError) {
        console.error('Failed to parse GeeLark response:', responseText)
        throw new Error(`Invalid JSON response from GeeLark API: ${responseText}`)
      }

      if (!response.ok) {
        console.error('GeeLark API HTTP error:', response.status, response.statusText, data)
        throw new Error(`GeeLark API error: ${response.status} ${response.statusText} - ${data?.msg || 'Unknown error'}`)
      }
      
      if (data.code !== 0) {
        console.error('GeeLark API error response:', data)
        throw new Error(`GeeLark API error: ${data.msg} (code: ${data.code})`)
      }

      return data.data
    } catch (error) {
      await supabaseAdmin.from('logs').insert({
        level: 'error',
        component: 'geelark-api',
        message: `API request failed: ${error}`,
        meta: { endpoint, error: String(error), url }
      })
      throw error
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
    return await this.request('/open/v1/task/query', {
      method: 'POST',
      body: JSON.stringify({
        ids: taskIds
      })
    })
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
    console.log(`[GeeLark] Starting phones: ${phoneIds.join(', ')}`)
    
    try {
      const response = await this.request<{
        successDetails?: Array<{ id: string; status: number }>
        failDetails?: Array<{ id: string; code: number; msg: string }>
      }>('/open/v1/phone/start', {
        method: 'POST',
        body: JSON.stringify({
          ids: phoneIds
        })
      })
      
      console.log(`[GeeLark] Start phones response:`, JSON.stringify(response, null, 2))
      
      // Log success/failure details
      if (response.successDetails) {
        console.log(`[GeeLark] Successfully started ${response.successDetails.length} phones`)
      }
      if (response.failDetails) {
        console.log(`[GeeLark] Failed to start ${response.failDetails.length} phones:`, response.failDetails)
      }
      
      await supabaseAdmin.from('logs').insert({
        level: 'info',
        component: 'geelark-api',
        message: 'Start phones API call',
        meta: {
          phone_ids: phoneIds,
          response: response,
          success_count: response.successDetails?.length || 0,
          fail_count: response.failDetails?.length || 0
        }
      })
      
      return response
    } catch (error) {
      console.error(`[GeeLark] Failed to start phones ${phoneIds.join(', ')}:`, error)
      
      await supabaseAdmin.from('logs').insert({
        level: 'error',
        component: 'geelark-api',
        message: 'Start phones API call failed',
        meta: {
          phone_ids: phoneIds,
          error: error instanceof Error ? error.message : String(error)
        }
      })
      
      throw error
    }
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

  async postTikTokCarousel(profileId: string, accountId: string, content: {
    images: string[]
    caption: string
    hashtags?: string[]
    music?: string
  }): Promise<string> {
    const data = await this.request<{ taskIds: string[] }>('/open/v1/task/add', {
      method: 'POST',
      body: JSON.stringify({
        planName: `carousel_${accountId}_${Date.now()}`,
        taskType: 3, // Publish image set
        list: [{
          scheduleAt: Math.floor(Date.now() / 1000),
          envId: profileId,
          images: content.images,
          videoDesc: content.caption + (content.hashtags ? ' ' + content.hashtags.join(' ') : ''),
          videoTitle: content.caption.substring(0, 50),
          maxTryTimes: 1,
          timeoutMin: 30
        }]
      })
    })

    const taskId = data.taskIds[0]

    await supabaseAdmin.from('tasks').insert({
      type: 'post',
      task_type: 'post',  // Required field
      geelark_task_id: taskId,
      account_id: accountId,
      status: 'running',
      started_at: new Date().toISOString(),
      meta: { type: 'carousel', images_count: content.images.length }
    })

    return taskId
  }

  async postTikTokVideo(profileId: string, accountId: string, content: {
    video_url: string
    caption: string
    hashtags?: string[]
    music?: string
  }): Promise<string> {
    const data = await this.request<{ taskIds: string[] }>('/open/v1/task/add', {
      method: 'POST',
      body: JSON.stringify({
        planName: `video_${accountId}_${Date.now()}`,
        taskType: 1, // Publish video
        list: [{
          scheduleAt: Math.floor(Date.now() / 1000),
          envId: profileId,
          video: content.video_url,
          videoDesc: content.caption + (content.hashtags ? ' ' + content.hashtags.join(' ') : ''),
          maxTryTimes: 1,
          timeoutMin: 30
        }]
      })
    })

    const taskId = data.taskIds[0]

    await supabaseAdmin.from('tasks').insert({
      type: 'post',
      task_type: 'post',  // Required field
      geelark_task_id: taskId,
      account_id: accountId,
      status: 'running',
      started_at: new Date().toISOString(),
      meta: { type: 'video' }
    })

    return taskId
  }

  async editTikTokProfile(profileId: string, profile: {
    avatar?: string
    nickName?: string
    bio?: string
    site?: string
  }): Promise<{ taskId: string }> {
    const data = await this.request<{ taskId: string }>('/open/v1/rpa/task/tiktokEdit', {
      method: 'POST',
      body: JSON.stringify({
        scheduleAt: Math.floor(Date.now() / 1000),
        id: profileId,
        ...profile
      })
    })

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'geelark-api',
      message: 'TikTok profile edit initiated',
      meta: { profile_id: profileId, task_id: data.taskId, changes: profile }
    })

    return data
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
    const response = await this.request<any>('/open/v1/phone/list', {
      method: 'POST',
      body: JSON.stringify({
        page: 1,
        pageSize: 100
      })
    })
    
    return response.items || []
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
    otpCode: string
  ): Promise<{ taskId: string }> {
    const formattedPhone = phoneNumber.startsWith('1') ? phoneNumber.substring(1) : phoneNumber
    
    const data = await this.createCustomRPATask(
      profileId,
      flowId,
      {
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
}

export const geelarkApi = new GeeLarkAPI()