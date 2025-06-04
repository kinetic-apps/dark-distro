import { supabaseAdmin } from './supabase/admin'

const API_BASE_URL = process.env.DAISYSMS_API_BASE_URL!
const API_KEY = process.env.DAISYSMS_API_KEY!

export interface RentalInfo {
  id: string
  rental_id: string
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

  async rentNumber(accountId?: string, longTermRental: boolean = false): Promise<RentalInfo> {
    console.log('DaisySMS rentNumber called with accountId:', accountId, 'longTermRental:', longTermRental)
    
    const params: Record<string, string> = {
      action: 'getNumber',
      service: 'lf',  // TikTok service code
      country: '0',   // USA
      max_price: '0.50'  // Set max price to 50 cents to handle price fluctuations
    }

    // Add long-term rental parameter if requested
    if (longTermRental) {
      params.ltr = '1'
      params.auto_renew = '1' // Enable auto-renew by default for long-term rentals
    }
    
    const response = await this.request(params)

    console.log('DaisySMS raw response:', response)

    const [status, rentalId, phoneNumber] = response.split(':')
    
    if (status !== 'ACCESS_NUMBER') {
      throw new Error(`Failed to rent number: ${response}`)
    }

    console.log('DaisySMS rental successful:', { status, rentalId, phoneNumber, longTermRental })

    const expiresAt = new Date()
    // Long-term rentals are active for 24 hours initially, then auto-renew daily
    expiresAt.setHours(expiresAt.getHours() + (longTermRental ? 24 : 72))

    const { data, error } = await supabaseAdmin
      .from('sms_rentals')
      .insert({
        rental_id: rentalId,
        phone_number: phoneNumber,
        status: 'waiting',
        expires_at: expiresAt.toISOString(),
        account_id: accountId,
        meta: {
          long_term_rental: longTermRental,
          auto_renew: longTermRental
        }
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to insert SMS rental:', error)
      throw new Error(`Failed to save rental to database: ${error.message}`)
    }

    if (!data) {
      throw new Error('Failed to save rental to database: no data returned')
    }

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'daisy-api',
      message: 'Phone number rented',
      meta: { 
        rental_id: rentalId, 
        phone_number: phoneNumber, 
        account_id: accountId, 
        service: 'lf',
        raw_response: response,
        long_term_rental: longTermRental
      }
    })

    return {
      id: data.id,
      rental_id: rentalId,
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
          otp: code,
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
    try {
      const response = await this.request({
      action: 'setStatus',
      id: rentalId,
      status: status
    })

      console.log(`DaisySMS setStatus response for rental ${rentalId}:`, response)

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
        meta: { rental_id: rentalId, response }
      })
    } catch (error) {
      // Log but don't throw - rental might already be completed/cancelled
      console.error(`Failed to set status for rental ${rentalId}:`, error)
      await supabaseAdmin.from('logs').insert({
        level: 'warning',
        component: 'daisy-api',
        message: `Failed to set rental status but continuing`,
        meta: { rental_id: rentalId, status, error: String(error) }
    })
    }
  }

  // Removed getActiveRentalsCount and canRentNewNumber methods
  // DaisySMS will handle their own rental limits and return appropriate errors

  async getBalance(): Promise<number> {
    const response = await this.request({
      action: 'getBalance'
    })

    // Response format: ACCESS_BALANCE:50.30
    if (response.startsWith('ACCESS_BALANCE:')) {
      const balance = parseFloat(response.split(':')[1])
      return balance
    }

    throw new Error(`Unexpected balance response: ${response}`)
  }
}

export const daisyApi = new DaisySMSAPI()