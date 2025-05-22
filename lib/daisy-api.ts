import { supabaseAdmin } from './supabase/admin'

const API_BASE_URL = process.env.DAISYSMS_API_BASE_URL!
const API_KEY = process.env.DAISYSMS_API_KEY!

export interface RentalInfo {
  id: string
  phone: string
  expires_at: Date
}

export interface OTPStatus {
  code: string | null
  status: 'waiting' | 'received' | 'expired' | 'cancelled'
}

export class DaisySMSAPI {
  private async request(params: Record<string, string>): Promise<any> {
    const url = new URL(API_BASE_URL)
    url.searchParams.append('api_key', API_KEY)
    
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })

    try {
      const response = await fetch(url.toString())
      const text = await response.text()

      if (!response.ok) {
        throw new Error(`DaisySMS API error: ${response.status} ${text}`)
      }

      if (text.startsWith('NO_NUMBERS')) {
        throw new Error('No numbers available')
      }

      if (text.startsWith('NO_BALANCE')) {
        throw new Error('Insufficient balance')
      }

      if (text.startsWith('BAD_KEY')) {
        throw new Error('Invalid API key')
      }

      if (text.startsWith('ERROR')) {
        throw new Error(`DaisySMS error: ${text}`)
      }

      return text
    } catch (error) {
      await supabaseAdmin.from('logs').insert({
        level: 'error',
        component: 'daisy-api',
        message: `API request failed: ${error}`,
        meta: { params, error: String(error) }
      })
      throw error
    }
  }

  async rentNumber(accountId?: string): Promise<RentalInfo> {
    const response = await this.request({
      action: 'getNumber',
      service: 'tiktok',
      country: '0'
    })

    const [status, rentalId, phoneNumber] = response.split(':')
    
    if (status !== 'ACCESS_NUMBER') {
      throw new Error(`Failed to rent number: ${response}`)
    }

    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 72)

    const { data } = await supabaseAdmin
      .from('sms_rentals')
      .insert({
        rental_id: rentalId,
        phone_number: phoneNumber,
        status: 'waiting',
        expires_at: expiresAt.toISOString(),
        account_id: accountId
      })
      .select()
      .single()

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'daisy-api',
      message: 'Phone number rented',
      meta: { rental_id: rentalId, phone_number: phoneNumber, account_id: accountId }
    })

    return {
      id: data.id,
      phone: phoneNumber,
      expires_at: expiresAt
    }
  }

  async checkOTP(rentalId: string): Promise<OTPStatus> {
    const response = await this.request({
      action: 'getStatus',
      id: rentalId
    })

    if (response === 'STATUS_WAIT_CODE') {
      return { code: null, status: 'waiting' }
    }

    if (response === 'STATUS_CANCEL') {
      await supabaseAdmin
        .from('sms_rentals')
        .update({ status: 'cancelled' })
        .eq('rental_id', rentalId)
      
      return { code: null, status: 'cancelled' }
    }

    if (response.startsWith('STATUS_OK')) {
      const code = response.split(':')[1]
      
      await supabaseAdmin
        .from('sms_rentals')
        .update({ 
          otp_code: code,
          status: 'received',
          updated_at: new Date().toISOString()
        })
        .eq('rental_id', rentalId)

      await supabaseAdmin.from('logs').insert({
        level: 'info',
        component: 'daisy-api',
        message: 'OTP received',
        meta: { rental_id: rentalId, code }
      })

      return { code, status: 'received' }
    }

    const activeRentals = await supabaseAdmin
      .from('sms_rentals')
      .select('expires_at')
      .eq('rental_id', rentalId)
      .single()

    if (activeRentals.data && new Date(activeRentals.data.expires_at) < new Date()) {
      await supabaseAdmin
        .from('sms_rentals')
        .update({ status: 'expired' })
        .eq('rental_id', rentalId)
      
      return { code: null, status: 'expired' }
    }

    return { code: null, status: 'waiting' }
  }

  async setStatus(rentalId: string, status: '6' | '8'): Promise<void> {
    await this.request({
      action: 'setStatus',
      id: rentalId,
      status: status
    })

    const statusText = status === '6' ? 'completed' : 'cancelled'
    
    await supabaseAdmin
      .from('sms_rentals')
      .update({ 
        status: statusText === 'completed' ? 'received' : 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('rental_id', rentalId)

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'daisy-api',
      message: `Rental ${statusText}`,
      meta: { rental_id: rentalId }
    })
  }

  async getActiveRentalsCount(): Promise<number> {
    const { count } = await supabaseAdmin
      .from('sms_rentals')
      .select('*', { count: 'exact', head: true })
      .in('status', ['waiting', 'received'])

    return count || 0
  }

  async canRentNewNumber(): Promise<boolean> {
    const count = await this.getActiveRentalsCount()
    return count < 20
  }
}

export const daisyApi = new DaisySMSAPI()