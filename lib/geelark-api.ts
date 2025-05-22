import { supabaseAdmin } from './supabase/admin'

const API_BASE_URL = process.env.GEELARK_API_BASE_URL!
const API_KEY = process.env.GEELARK_API_KEY!
const APP_ID = process.env.GEELARK_APP_ID!

interface GeeLarkResponse<T> {
  code: number
  msg: string
  data: T
}

interface CreateProfileData {
  profile_id: string
  device_info: {
    model: string
    brand: string
    android_version: string
  }
}

interface TaskData {
  task_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
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
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'X-App-ID': APP_ID,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      if (!response.ok) {
        throw new Error(`GeeLark API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json() as GeeLarkResponse<T>
      
      if (data.code !== 0) {
        throw new Error(`GeeLark API error: ${data.msg}`)
      }

      return data.data
    } catch (error) {
      await supabaseAdmin.from('logs').insert({
        level: 'error',
        component: 'geelark-api',
        message: `API request failed: ${error}`,
        meta: { endpoint, error: String(error) }
      })
      throw error
    }
  }

  async createProfile(deviceInfo?: Partial<CreateProfileData['device_info']>): Promise<CreateProfileData> {
    const data = await this.request<CreateProfileData>('/api/v1/profiles', {
      method: 'POST',
      body: JSON.stringify({
        device_info: {
          model: deviceInfo?.model || 'Pixel 6',
          brand: deviceInfo?.brand || 'Google',
          android_version: deviceInfo?.android_version || '13',
        }
      })
    })

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'geelark-api',
      message: 'Profile created',
      meta: { profile_id: data.profile_id }
    })

    return data
  }

  async deleteProfile(profileId: string): Promise<void> {
    await this.request(`/api/v1/profiles/${profileId}`, {
      method: 'DELETE'
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
    await this.request(`/api/v1/profiles/${profileId}/proxy`, {
      method: 'PUT',
      body: JSON.stringify({
        proxy_type: 'http',
        proxy_host: proxy.host,
        proxy_port: proxy.port,
        proxy_username: proxy.username,
        proxy_password: proxy.password,
      })
    })

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'geelark-api',
      message: 'Proxy set for profile',
      meta: { profile_id: profileId, proxy_host: proxy.host }
    })
  }

  async startWarmupTask(profileId: string, accountId: string): Promise<string> {
    const data = await this.request<TaskData>('/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify({
        profile_id: profileId,
        task_type: 'automation',
        template_name: 'ai-warmup',
        params: {
          duration_minutes: 30,
          actions: ['browse', 'like', 'follow', 'comment']
        }
      })
    })

    await supabaseAdmin.from('tasks').insert({
      type: 'warmup',
      geelark_task_id: data.task_id,
      account_id: accountId,
      status: 'running',
      started_at: new Date().toISOString()
    })

    return data.task_id
  }

  async postVideo(profileId: string, accountId: string, video: {
    url: string
    caption: string
    hashtags?: string[]
  }): Promise<string> {
    const data = await this.request<TaskData>('/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify({
        profile_id: profileId,
        task_type: 'post',
        params: {
          video_url: video.url,
          caption: video.caption,
          hashtags: video.hashtags || []
        }
      })
    })

    await supabaseAdmin.from('tasks').insert({
      type: 'post',
      geelark_task_id: data.task_id,
      account_id: accountId,
      status: 'running',
      started_at: new Date().toISOString()
    })

    return data.task_id
  }

  async getTaskStatus(taskId: string): Promise<TaskData> {
    return await this.request<TaskData>(`/api/v1/tasks/${taskId}`)
  }

  async getProfileStatus(profileId: string): Promise<ProfileStatus> {
    return await this.request<ProfileStatus>(`/api/v1/profiles/${profileId}/status`)
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
}

export const geelarkApi = new GeeLarkAPI()