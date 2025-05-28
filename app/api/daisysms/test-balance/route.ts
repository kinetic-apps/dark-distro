import { NextRequest, NextResponse } from 'next/server'
import { daisyApi } from '@/lib/daisy-api'

export async function GET(request: NextRequest) {
  try {
    console.log('Testing DaisySMS API...')
    console.log('API URL:', process.env.DAISYSMS_API_BASE_URL)
    console.log('API Key:', process.env.DAISYSMS_API_KEY?.substring(0, 10) + '...')
    
    // Test balance check
    const balance = await daisyApi.getBalance()
    
    console.log('Balance check successful:', balance)
    
    // Try to get services list
    let services = null
    let tiktokService = null
    let foundServices: any = {}
    let actualTikTokService = null
    let servicesAt25Cents: any[] = []
    let allServicesWithPrices: any[] = []
    let possibleTikTokServices: any[] = []
    try {
      const servicesUrl = new URL(process.env.DAISYSMS_API_BASE_URL!)
      servicesUrl.searchParams.append('api_key', process.env.DAISYSMS_API_KEY!)
      servicesUrl.searchParams.append('action', 'getPricesVerification')
      
      const servicesResponse = await fetch(servicesUrl.toString())
      if (servicesResponse.ok) {
        services = await servicesResponse.json()
        
        // Search for TikTok service
        for (const [code, data] of Object.entries(services)) {
          if (code.toLowerCase().includes('tik') || code.toLowerCase().includes('tok') || code === 'tg' || code === 'ig') {
            tiktokService = { code, data }
            break
          }
        }
        
        // Also check specific codes
        const checkCodes = ['tg', 'ig', 'tt', 'tk', 'tiktok', 'wa', 'wb', 'ds'];
        for (const code of checkCodes) {
          if (services[code]) {
            foundServices[code] = services[code];
          }
        }

        // Search for TikTok service by name
        let actualTikTokService = null;
        for (const [code, countryData] of Object.entries(services)) {
          if (typeof countryData === 'object' && countryData !== null) {
            for (const [countryCode, serviceData] of Object.entries(countryData as any)) {
              if (serviceData && typeof serviceData === 'object' && 'name' in serviceData) {
                const name = (serviceData as any).name;
                if (name && name.toLowerCase().includes('tiktok')) {
                  actualTikTokService = { 
                    code, 
                    name,
                    data: serviceData,
                    country: countryCode
                  };
                  break;
                }
              }
            }
            if (actualTikTokService) break;
          }
        }

        // Search for services with cost $0.25 (TikTok price from website)
        let servicesAt25Cents: any[] = [];
        for (const [code, countryData] of Object.entries(services)) {
          if (typeof countryData === 'object' && countryData !== null) {
            for (const [countryCode, serviceData] of Object.entries(countryData as any)) {
              if (serviceData && typeof serviceData === 'object' && 'cost' in serviceData) {
                const cost = (serviceData as any).cost;
                if (cost === '0.25') {
                  servicesAt25Cents.push({ 
                    code, 
                    name: (serviceData as any).name,
                    data: serviceData,
                    country: countryCode
                  });
                }
              }
            }
          }
        }

        // Get ALL services with their names and prices
        allServicesWithPrices = [];
        for (const [code, countryData] of Object.entries(services)) {
          if (typeof countryData === 'object' && countryData !== null) {
            const data = countryData as any;
            if (data['187']) {
              const usaService = data['187'];
              if (usaService && usaService.name && usaService.cost) {
                allServicesWithPrices.push({
                  code,
                  name: usaService.name,
                  cost: usaService.cost
                });
              }
            }
          }
        }
        
        // Sort by name to make it easier to find TikTok
        allServicesWithPrices.sort((a, b) => a.name.localeCompare(b.name));
        
        // Also search for any service containing 'tok' or 'tik' in code or name
        possibleTikTokServices = allServicesWithPrices.filter(s => 
          s.code.toLowerCase().includes('tik') || 
          s.code.toLowerCase().includes('tok') ||
          s.name.toLowerCase().includes('tik') ||
          s.name.toLowerCase().includes('tok')
        );
      }
    } catch (error) {
      console.error('Failed to get services:', error)
    }
    
    return NextResponse.json({
      success: true,
      balance,
      api_configured: true,
      api_url: process.env.DAISYSMS_API_BASE_URL,
      total_services: allServicesWithPrices.length,
      all_services: allServicesWithPrices, // Show ALL services
      possible_tiktok: possibleTikTokServices,
      services_at_25_cents: servicesAt25Cents.slice(0, 10),
      checked_services: foundServices
    })
  } catch (error) {
    console.error('DaisySMS test error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      api_url: process.env.DAISYSMS_API_BASE_URL,
      api_key_present: !!process.env.DAISYSMS_API_KEY
    }, { status: 500 })
  }
} 