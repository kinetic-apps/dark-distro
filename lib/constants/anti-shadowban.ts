import type { AntiShadowbanPreset, AntiShadowbanSettings } from '@/lib/types/image-generation'

// Device metadata for different iPhone models
export const IPHONE_METADATA = {
  iphone12: {
    make: 'Apple',
    model: 'iPhone 12',
    software: 'iOS 15.6',
    lens: '26mm f/1.6',
    focalLength: 4.2,
    aperture: 1.6,
    isoRange: [32, 200],
    shutterSpeedRange: [1/1000, 1/30],
  },
  iphone13: {
    make: 'Apple',
    model: 'iPhone 13',
    software: 'iOS 16.3',
    lens: '26mm f/1.5',
    focalLength: 5.1,
    aperture: 1.5,
    isoRange: [50, 400],
    shutterSpeedRange: [1/2000, 1/30],
  },
  iphone14: {
    make: 'Apple',
    model: 'iPhone 14',
    software: 'iOS 17.1',
    lens: '26mm f/1.5',
    focalLength: 5.1,
    aperture: 1.5,
    isoRange: [50, 800],
    shutterSpeedRange: [1/2000, 1/15],
  },
  iphone15: {
    make: 'Apple',
    model: 'iPhone 15 Pro',
    software: 'iOS 17.4',
    lens: '24mm f/1.78',
    focalLength: 6.86,
    aperture: 1.78,
    isoRange: [64, 1600],
    shutterSpeedRange: [1/4000, 1/15],
  },
}

// Popular photo locations for realistic GPS data
export const PHOTO_LOCATIONS = [
  { name: 'New York', lat: 40.7128, lng: -74.0060 },
  { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
  { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
  { name: 'Houston', lat: 29.7604, lng: -95.3698 },
  { name: 'Phoenix', lat: 33.4484, lng: -112.0740 },
  { name: 'Philadelphia', lat: 39.9526, lng: -75.1652 },
  { name: 'San Antonio', lat: 29.4241, lng: -98.4936 },
  { name: 'San Diego', lat: 32.7157, lng: -117.1611 },
  { name: 'Dallas', lat: 32.7767, lng: -96.7970 },
  { name: 'Austin', lat: 30.2672, lng: -97.7431 },
  { name: 'Miami', lat: 25.7617, lng: -80.1918 },
  { name: 'Seattle', lat: 47.6062, lng: -122.3321 },
  { name: 'Denver', lat: 39.7392, lng: -104.9903 },
  { name: 'Boston', lat: 42.3601, lng: -71.0589 },
  { name: 'San Francisco', lat: 37.7749, lng: -122.4194 },
]

// Anti-shadowban presets
export const ANTI_SHADOWBAN_PRESETS: AntiShadowbanPreset[] = [
  {
    name: 'light',
    description: 'Minimal modifications for trusted accounts',
    settings: {
      metadata: {
        enabled: true,
        deviceType: 'random',
        locationVariance: 2,
      },
      borders: {
        enabled: false,
        minWidth: 0,
        maxWidth: 0,
        colorMode: 'random',
        asymmetric: false,
      },
      fractures: {
        enabled: false,
        intensity: 'subtle',
        count: 0,
        opacity: 0,
      },
      microNoise: {
        enabled: true,
        intensity: 5,
      },
      colorShift: {
        enabled: false,
        hueVariance: 0,
        saturationVariance: 0,
        lightnessVariance: 0,
      },
      compression: {
        enabled: true,
        qualityMin: 92,
        qualityMax: 95,
      },
      invisibleWatermark: {
        enabled: false,
        data: '',
      },
      fileNaming: {
        pattern: 'iphone',
      },
      processingDelay: {
        enabled: false,
        minMs: 0,
        maxMs: 0,
      },
    },
  },
  {
    name: 'standard',
    description: 'Balanced approach for regular use',
    settings: {
      metadata: {
        enabled: true,
        deviceType: 'random',
        locationVariance: 5,
      },
      borders: {
        enabled: true,
        minWidth: 1,
        maxWidth: 2,
        colorMode: 'sampled',
        asymmetric: true,
      },
      fractures: {
        enabled: true,
        intensity: 'subtle',
        count: 2,
        opacity: 15,
      },
      microNoise: {
        enabled: true,
        intensity: 10,
      },
      colorShift: {
        enabled: true,
        hueVariance: 2,
        saturationVariance: 2,
        lightnessVariance: 1,
      },
      compression: {
        enabled: true,
        qualityMin: 88,
        qualityMax: 93,
      },
      invisibleWatermark: {
        enabled: true,
        data: '',
      },
      fileNaming: {
        pattern: 'iphone',
      },
      processingDelay: {
        enabled: true,
        minMs: 100,
        maxMs: 500,
      },
    },
  },
  {
    name: 'maximum',
    description: 'All features enabled for high-risk accounts',
    settings: {
      metadata: {
        enabled: true,
        deviceType: 'random',
        locationVariance: 10,
      },
      borders: {
        enabled: true,
        minWidth: 1,
        maxWidth: 3,
        colorMode: 'sampled',
        asymmetric: true,
      },
      fractures: {
        enabled: true,
        intensity: 'light',
        count: 3,
        opacity: 25,
      },
      microNoise: {
        enabled: true,
        intensity: 15,
      },
      colorShift: {
        enabled: true,
        hueVariance: 3,
        saturationVariance: 3,
        lightnessVariance: 2,
      },
      compression: {
        enabled: true,
        qualityMin: 85,
        qualityMax: 92,
      },
      invisibleWatermark: {
        enabled: true,
        data: '',
      },
      fileNaming: {
        pattern: 'iphone',
      },
      processingDelay: {
        enabled: true,
        minMs: 500,
        maxMs: 2000,
      },
    },
  },
]

// Default settings for custom mode
export const DEFAULT_ANTI_SHADOWBAN_SETTINGS: AntiShadowbanSettings = {
  preset: 'standard',
  metadata: {
    enabled: true,
    deviceType: 'random',
    locationVariance: 5,
  },
  borders: {
    enabled: true,
    minWidth: 1,
    maxWidth: 2,
    colorMode: 'sampled',
    asymmetric: true,
  },
  fractures: {
    enabled: true,
    intensity: 'subtle',
    count: 2,
    opacity: 15,
  },
  microNoise: {
    enabled: true,
    intensity: 10,
  },
  colorShift: {
    enabled: true,
    hueVariance: 2,
    saturationVariance: 2,
    lightnessVariance: 1,
  },
  compression: {
    enabled: true,
    qualityMin: 88,
    qualityMax: 93,
  },
  invisibleWatermark: {
    enabled: true,
    data: '',
  },
  fileNaming: {
    pattern: 'iphone',
  },
  processingDelay: {
    enabled: true,
    minMs: 100,
    maxMs: 500,
  },
} 