import { supabaseAdmin } from './supabase/admin'

const API_BASE_URL = process.env.SOAX_API_BASE_URL!
const API_KEY = process.env.SOAX_API_KEY!
const PACKAGE_KEY = process.env.SOAX_PACKAGE_KEY!

export interface ProxyCredentials {
  host: string
  port: number
  username: string
  password: string
  sessionId?: string
}

interface SOAXResponse<T> {
  success: boolean
  data: T
  error?: string
}

interface ProxyStats {
  bandwidth_used: number
  bandwidth_limit: number
  active_sessions: number
  blocked_count: number
}

export class SOAXAPI {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      if (!response.ok) {
        throw new Error(`SOAX API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json() as SOAXResponse<T>
      
      if (!data.success) {
        throw new Error(`SOAX API error: ${data.error}`)
      }

      return data.data
    } catch (error) {
      await supabaseAdmin.from('logs').insert({
        level: 'error',
        component: 'soax-api',
        message: `API request failed: ${error}`,
        meta: { endpoint, error: String(error) }
      })
      throw error
    }
  }

  generateStickySession(): string {
    return Math.random().toString(36).substring(2, 15)
  }

  getStickyPoolProxy(sessionId?: string): ProxyCredentials {
    const session = sessionId || this.generateStickySession()
    return {
      host: process.env.SOAX_POOL_HOST!,
      port: parseInt(process.env.SOAX_POOL_PORT!),
      username: `package-${PACKAGE_KEY}-sessionid-${session}`,
      password: PACKAGE_KEY,
      sessionId: session
    }
  }

  getRotatingPoolProxy(): ProxyCredentials {
    return {
      host: process.env.SOAX_POOL_HOST!,
      port: parseInt(process.env.SOAX_ROTATING_PORT!),
      username: PACKAGE_KEY,
      password: PACKAGE_KEY,
    }
  }

  getDedicatedSIMProxy(port: number): ProxyCredentials {
    return {
      host: process.env.SOAX_SIM_HOST!,
      port: port,
      username: process.env.SOAX_SIM_USERNAME!,
      password: process.env.SOAX_SIM_PASSWORD!,
    }
  }

  async getPackageStats(): Promise<ProxyStats> {
    return await this.request<ProxyStats>(`/packages/${PACKAGE_KEY}/stats`)
  }

  async whitelistIP(ip: string): Promise<void> {
    await this.request(`/packages/${PACKAGE_KEY}/whitelist`, {
      method: 'POST',
      body: JSON.stringify({ ip })
    })

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'soax-api',
      message: 'IP whitelisted',
      meta: { ip }
    })
  }

  async getWhitelistedIPs(): Promise<string[]> {
    const data = await this.request<{ ips: string[] }>(`/packages/${PACKAGE_KEY}/whitelist`)
    return data.ips
  }

  async removeWhitelistedIP(ip: string): Promise<void> {
    await this.request(`/packages/${PACKAGE_KEY}/whitelist/${ip}`, {
      method: 'DELETE'
    })

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'soax-api',
      message: 'IP removed from whitelist',
      meta: { ip }
    })
  }

  async checkProxyHealth(proxy: ProxyCredentials): Promise<boolean> {
    try {
      const response = await fetch('https://api.ipify.org?format=json', {
        method: 'GET',
        headers: {
          'Proxy-Authorization': `Basic ${Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64')}`
        },
      })

      if (response.ok) {
        const data = await response.json()
        await supabaseAdmin
          .from('proxies')
          .update({ 
            current_ip: data.ip,
            health: 'good',
            updated_at: new Date().toISOString()
          })
          .eq('host', proxy.host)
          .eq('port', proxy.port)
        
        return true
      }
      
      return false
    } catch (error) {
      await supabaseAdmin.from('logs').insert({
        level: 'warning',
        component: 'soax-api',
        message: 'Proxy health check failed',
        meta: { proxy: proxy.host, error: String(error) }
      })
      
      return false
    }
  }

  async rotateProxy(proxyId: string): Promise<void> {
    const { data: proxy } = await supabaseAdmin
      .from('proxies')
      .select('*')
      .eq('id', proxyId)
      .single()

    if (!proxy) {
      throw new Error('Proxy not found')
    }

    if (proxy.type === 'sticky') {
      const newSessionId = this.generateStickySession()
      
      await supabaseAdmin
        .from('proxies')
        .update({
          session_id: newSessionId,
          username: `package-${PACKAGE_KEY}-sessionid-${newSessionId}`,
          last_rotated: new Date().toISOString(),
          current_ip: null,
          health: 'unknown'
        })
        .eq('id', proxyId)

      await supabaseAdmin.from('logs').insert({
        level: 'info',
        component: 'soax-api',
        message: 'Sticky proxy rotated',
        meta: { proxy_id: proxyId, new_session_id: newSessionId }
      })
    } else if (proxy.type === 'sim') {
      await supabaseAdmin.from('logs').insert({
        level: 'warning',
        component: 'soax-api',
        message: 'SIM proxy rotation not supported via API',
        meta: { proxy_id: proxyId }
      })
    }
  }
}

export const soaxApi = new SOAXAPI()