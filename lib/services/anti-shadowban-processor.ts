import sharp from 'sharp'
import crypto from 'crypto'
import { IPHONE_METADATA, PHOTO_LOCATIONS } from '@/lib/constants/anti-shadowban'
import type { AntiShadowbanSettings } from '@/lib/types/image-generation'

export class AntiShadowbanProcessor {
  private settings: AntiShadowbanSettings
  private variantIndex: number
  private imageIndex: number
  private baseTimestamp: Date

  constructor(settings: AntiShadowbanSettings, variantIndex: number, imageIndex: number) {
    this.settings = settings
    this.variantIndex = variantIndex
    this.imageIndex = imageIndex
    // Base timestamp with some random variation
    this.baseTimestamp = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) // Within last week
  }

  async processImage(imageBuffer: Buffer): Promise<Buffer> {
    let processedImage = sharp(imageBuffer)
    const metadata = await processedImage.metadata()
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to read image dimensions')
    }

    // Apply processing delay if enabled
    if (this.settings.processingDelay.enabled) {
      const delay = this.randomBetween(
        this.settings.processingDelay.minMs,
        this.settings.processingDelay.maxMs
      )
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    // Apply modifications in sequence
    processedImage = await this.applyBorders(processedImage, metadata.width, metadata.height)
    processedImage = await this.applyFractures(processedImage, metadata.width, metadata.height)
    processedImage = await this.applyMicroNoise(processedImage)
    processedImage = await this.applyColorShift(processedImage)
    processedImage = await this.applyWatermark(processedImage, metadata.width, metadata.height)

    // Apply metadata (must be last as it requires final buffer)
    const finalBuffer = await this.applyCompression(processedImage)
    return this.applyMetadata(finalBuffer)
  }

  private async applyBorders(image: sharp.Sharp, width: number, height: number): Promise<sharp.Sharp> {
    if (!this.settings.borders.enabled) return image

    // Get edge colors if using sampled mode
    let borderColor = '#000000'
    if (this.settings.borders.colorMode === 'sampled') {
      // Extract a 1px edge from the image to sample color
      const edgeBuffer = await image.clone()
        .extract({ left: 0, top: Math.floor(height / 2), width: 1, height: 1 })
        .toBuffer()
      const { data } = await sharp(edgeBuffer).raw().toBuffer({ resolveWithObject: true })
      borderColor = `#${data[0].toString(16).padStart(2, '0')}${data[1].toString(16).padStart(2, '0')}${data[2].toString(16).padStart(2, '0')}`
    } else if (this.settings.borders.colorMode === 'random') {
      // Generate random color
      borderColor = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`
    } else if (this.settings.borders.customColors && this.settings.borders.customColors.length > 0) {
      // Use custom color
      borderColor = this.settings.borders.customColors[
        Math.floor(Math.random() * this.settings.borders.customColors.length)
      ]
    }

    // Calculate border widths - ensure they are positive integers
    const borders = {
      top: Math.round(this.randomBetween(this.settings.borders.minWidth, this.settings.borders.maxWidth)),
      right: Math.round(this.randomBetween(this.settings.borders.minWidth, this.settings.borders.maxWidth)),
      bottom: Math.round(this.randomBetween(this.settings.borders.minWidth, this.settings.borders.maxWidth)),
      left: Math.round(this.randomBetween(this.settings.borders.minWidth, this.settings.borders.maxWidth)),
    }

    if (!this.settings.borders.asymmetric) {
      // Use same width for all sides
      const uniformWidth = borders.top
      borders.right = uniformWidth
      borders.bottom = uniformWidth
      borders.left = uniformWidth
    }

    // Apply borders using extend
    return image.extend({
      top: borders.top,
      right: borders.right,
      bottom: borders.bottom,
      left: borders.left,
      background: borderColor
    })
  }

  private async applyFractures(image: sharp.Sharp, width: number, height: number): Promise<sharp.Sharp> {
    if (!this.settings.fractures.enabled || this.settings.fractures.count === 0) return image

    // Create fracture overlay
    const fractureOpacity = this.settings.fractures.opacity / 100
    const strokeWidth = this.settings.fractures.intensity === 'subtle' ? 1 : 
                       this.settings.fractures.intensity === 'light' ? 2 : 3

    // Generate random fracture lines
    const fractures: string[] = []
    for (let i = 0; i < this.settings.fractures.count; i++) {
      // Random starting point on edge
      const edge = Math.floor(Math.random() * 4)
      let x1, y1, x2, y2
      
      switch (edge) {
        case 0: // Top edge
          x1 = Math.random() * width
          y1 = 0
          x2 = Math.random() * width
          y2 = height * (0.3 + Math.random() * 0.4)
          break
        case 1: // Right edge
          x1 = width
          y1 = Math.random() * height
          x2 = width * (0.3 + Math.random() * 0.4)
          y2 = Math.random() * height
          break
        case 2: // Bottom edge
          x1 = Math.random() * width
          y1 = height
          x2 = Math.random() * width
          y2 = height * (0.3 + Math.random() * 0.4)
          break
        case 3: // Left edge
          x1 = 0
          y1 = Math.random() * height
          x2 = width * (0.3 + Math.random() * 0.4)
          y2 = Math.random() * height
          break
      }

      // Add some curve to the line using quadratic bezier
      const cx = (x1! + x2!) / 2 + (Math.random() - 0.5) * 50
      const cy = (y1! + y2!) / 2 + (Math.random() - 0.5) * 50
      
      fractures.push(`<path d="M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}" 
        stroke="rgba(255,255,255,${fractureOpacity})" 
        stroke-width="${strokeWidth}" 
        fill="none" />`)
    }

    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        ${fractures.join('\n')}
      </svg>
    `

    const overlay = await sharp(Buffer.from(svg)).png().toBuffer()
    
    return image.composite([{
      input: overlay,
      blend: 'over'
    }])
  }

  private async applyMicroNoise(image: sharp.Sharp): Promise<sharp.Sharp> {
    if (!this.settings.microNoise.enabled || this.settings.microNoise.intensity === 0) return image

    const { width, height } = await image.metadata()
    if (!width || !height) return image

    // Generate noise pattern using a random pixel approach
    const noiseIntensity = this.settings.microNoise.intensity / 100
    const noisePixels = Buffer.alloc(width * height * 4)
    
    // Fill with random noise
    for (let i = 0; i < noisePixels.length; i += 4) {
      const noise = (Math.random() - 0.5) * 50 // Random value between -25 and 25
      const pixelValue = Math.round(128 + noise)
      noisePixels[i] = pixelValue     // R
      noisePixels[i + 1] = pixelValue // G
      noisePixels[i + 2] = pixelValue // B
      noisePixels[i + 3] = Math.round(255 * noiseIntensity) // Alpha
    }
    
    const noise = await sharp(noisePixels, {
      raw: {
        width,
        height,
        channels: 4
      }
    }).png().toBuffer()

    return image.composite([{
      input: noise,
      blend: 'overlay'
    }])
  }

  private async applyColorShift(image: sharp.Sharp): Promise<sharp.Sharp> {
    if (!this.settings.colorShift.enabled) return image

    // Calculate hue shift in degrees (0-360) - Sharp expects integer degrees
    const hueShiftDegrees = Math.round((Math.random() - 0.5) * 2 * this.settings.colorShift.hueVariance)
    // Ensure hue is within valid range (0-360)
    const normalizedHue = ((hueShiftDegrees % 360) + 360) % 360
    
    const saturationMultiplier = 1 + ((Math.random() - 0.5) * 2 * this.settings.colorShift.saturationVariance) / 100
    const lightnessShift = (Math.random() - 0.5) * 2 * this.settings.colorShift.lightnessVariance

    // Apply color modifications - Sharp expects specific parameter types
    return image.modulate({
      hue: normalizedHue, // Integer degrees (0-360)
      saturation: Math.max(0.1, saturationMultiplier), // Ensure positive value
      lightness: Math.max(0.1, 1 + (lightnessShift / 100)) // Ensure positive value
    })
  }

  private async applyWatermark(image: sharp.Sharp, width: number, height: number): Promise<sharp.Sharp> {
    if (!this.settings.invisibleWatermark.enabled) return image

    // Generate watermark data
    const watermarkData = this.settings.invisibleWatermark.data || 
      `${this.variantIndex}-${this.imageIndex}-${Date.now()}`
    
    // Create a very subtle pattern based on the data
    const hash = crypto.createHash('sha256').update(watermarkData).digest()
    const pattern: number[] = []
    
    // Create a 8x8 pattern from hash
    for (let i = 0; i < 64; i++) {
      pattern.push(hash[i % hash.length] % 2 === 0 ? 1 : 0)
    }

    // Create subtle watermark SVG (nearly invisible)
    const watermarkSvg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        ${pattern.map((bit, i) => {
          const x = (i % 8) * (width / 8)
          const y = Math.floor(i / 8) * (height / 8)
          return bit === 1 ? 
            `<rect x="${x}" y="${y}" width="${width/8}" height="${height/8}" fill="rgba(0,0,0,0.002)" />` : ''
        }).join('\n')}
      </svg>
    `

    const watermark = await sharp(Buffer.from(watermarkSvg)).png().toBuffer()
    
    return image.composite([{
      input: watermark,
      blend: 'multiply'
    }])
  }

  private async applyCompression(image: sharp.Sharp): Promise<Buffer> {
    if (!this.settings.compression.enabled) {
      return image.jpeg({ quality: 95 }).toBuffer()
    }

    const quality = this.randomBetween(
      this.settings.compression.qualityMin,
      this.settings.compression.qualityMax
    )

    return image.jpeg({ 
      quality: Math.round(quality),
      progressive: true,
      optimizeCoding: true
    }).toBuffer()
  }

  private async applyMetadata(imageBuffer: Buffer): Promise<Buffer> {
    if (!this.settings.metadata.enabled) return imageBuffer

    // Select device
    const deviceTypes = Object.keys(IPHONE_METADATA) as Array<keyof typeof IPHONE_METADATA>
    const deviceType = this.settings.metadata.deviceType === 'random' 
      ? deviceTypes[Math.floor(Math.random() * deviceTypes.length)]
      : this.settings.metadata.deviceType

    const device = IPHONE_METADATA[deviceType]

    // Generate GPS coordinates
    const baseLocation = this.settings.metadata.baseLocation || 
      PHOTO_LOCATIONS[Math.floor(Math.random() * PHOTO_LOCATIONS.length)]
    
    const gpsLat = baseLocation.lat + (Math.random() - 0.5) * (this.settings.metadata.locationVariance / 111) // ~111km per degree
    const gpsLng = baseLocation.lng + (Math.random() - 0.5) * (this.settings.metadata.locationVariance / 111)

    // Generate camera settings
    const iso = this.randomBetween(device.isoRange[0], device.isoRange[1])
    const shutterSpeed = device.shutterSpeedRange[0] + 
      Math.random() * (device.shutterSpeedRange[1] - device.shutterSpeedRange[0])
    
    // Calculate timestamp with variation
    const timestamp = new Date(
      this.baseTimestamp.getTime() + 
      (this.variantIndex * 60000) + // 1 minute between variants
      (this.imageIndex * 15000) + // 15 seconds between images
      (Math.random() * 5000) // 0-5 second random variation
    )

    // Apply metadata using sharp - withExif expects string values
    const exifData = {
      IFD0: {
        Make: device.make,
        Model: device.model,
        Software: device.software,
        DateTime: timestamp.toISOString().replace('T', ' ').substring(0, 19),
        Orientation: '1'
      },
      IFD1: {
        Compression: '6' // JPEG compression
      },
      IFD3: {
        DateTimeOriginal: timestamp.toISOString().replace('T', ' ').substring(0, 19),
        CreateDate: timestamp.toISOString().replace('T', ' ').substring(0, 19),
        FNumber: device.aperture.toString(),
        ISO: Math.round(iso).toString(),
        ShutterSpeedValue: shutterSpeed.toFixed(4),
        ApertureValue: device.aperture.toString(),
        FocalLength: device.focalLength.toString(),
        LensModel: device.lens,
        ColorSpace: '1', // sRGB
        GPSLatitudeRef: gpsLat >= 0 ? 'N' : 'S',
        GPSLatitude: this.formatGPSCoordinate(Math.abs(gpsLat)),
        GPSLongitudeRef: gpsLng >= 0 ? 'E' : 'W',
        GPSLongitude: this.formatGPSCoordinate(Math.abs(gpsLng)),
        GPSAltitude: Math.round(20 + Math.random() * 100).toString(),
        GPSAltitudeRef: '0', // Above sea level
        GPSTimeStamp: `${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}:${timestamp.getSeconds().toString().padStart(2, '0')}`
      }
    }

    return sharp(imageBuffer)
      .withExif(exifData)
      .toBuffer()
  }

  generateFileName(): string {
    if (this.settings.fileNaming.pattern === 'iphone') {
      // iPhone naming pattern: IMG_XXXX.jpg
      const baseNumber = this.settings.fileNaming.sequentialStart || 1000
      const number = baseNumber + (this.variantIndex * 100) + this.imageIndex + Math.floor(Math.random() * 10)
      return `IMG_${number.toString().padStart(4, '0')}.jpg`
    } else if (this.settings.fileNaming.pattern === 'sequential') {
      const number = (this.variantIndex * 1000) + this.imageIndex
      return `image_${number.toString().padStart(6, '0')}.jpg`
    } else {
      // Random naming
      const randomString = crypto.randomBytes(8).toString('hex')
      return `photo_${randomString}.jpg`
    }
  }

  private randomBetween(min: number, max: number): number {
    return min + Math.random() * (max - min)
  }

  private formatGPSCoordinate(decimal: number): string {
    // Convert decimal degrees to degrees/minutes/seconds format for EXIF
    const degrees = Math.floor(decimal)
    const minutesDecimal = (decimal - degrees) * 60
    const minutes = Math.floor(minutesDecimal)
    const seconds = Math.round((minutesDecimal - minutes) * 60 * 100) // Multiply by 100 for fraction
    
    return `${degrees}/1 ${minutes}/1 ${seconds}/100`
  }
} 