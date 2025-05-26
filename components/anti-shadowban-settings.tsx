'use client'

import { useState, useEffect } from 'react'
import { 
  Shield, 
  Settings, 
  MapPin, 
  Smartphone,
  Frame,
  Zap,
  Palette,
  FileImage,
  Hash,
  Clock,
  ChevronRight,
  ChevronDown,
  Info
} from 'lucide-react'
import { 
  ANTI_SHADOWBAN_PRESETS, 
  DEFAULT_ANTI_SHADOWBAN_SETTINGS,
  IPHONE_METADATA,
  PHOTO_LOCATIONS 
} from '@/lib/constants/anti-shadowban'
import type { AntiShadowbanSettings } from '@/lib/types/image-generation'

interface AntiShadowbanSettingsProps {
  settings: AntiShadowbanSettings
  onChange: (settings: AntiShadowbanSettings) => void
}

export function AntiShadowbanSettings({ settings, onChange }: AntiShadowbanSettingsProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [localSettings, setLocalSettings] = useState<AntiShadowbanSettings>(settings)

  useEffect(() => {
    setLocalSettings(settings)
  }, [settings])

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  const handlePresetChange = (presetName: 'light' | 'standard' | 'maximum' | 'custom') => {
    if (presetName === 'custom') {
      const newSettings = { ...DEFAULT_ANTI_SHADOWBAN_SETTINGS, preset: 'custom' as const }
      setLocalSettings(newSettings)
      onChange(newSettings)
      // Expand all sections for custom mode
      setExpandedSections(new Set(['metadata', 'borders', 'fractures', 'advanced', 'file']))
    } else {
      const preset = ANTI_SHADOWBAN_PRESETS.find(p => p.name === presetName)
      if (preset) {
        const newSettings = { 
          ...DEFAULT_ANTI_SHADOWBAN_SETTINGS, 
          ...preset.settings, 
          preset: presetName 
        }
        setLocalSettings(newSettings)
        onChange(newSettings)
        // Collapse all sections for presets
        setExpandedSections(new Set())
      }
    }
  }

  const updateNestedSetting = (path: string[], value: any) => {
    const newSettings = { ...localSettings }
    let current: any = newSettings
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]]
    }
    current[path[path.length - 1]] = value
    newSettings.preset = 'custom'
    setLocalSettings(newSettings)
    onChange(newSettings)
  }

  return (
    <div className="card-lg space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <Shield className="h-5 w-5 text-gray-700 dark:text-dark-300" />
        <h3 className="text-base font-medium text-gray-900 dark:text-dark-100">
          Anti-Shadowban Protection
        </h3>
      </div>

      {/* Preset Selection */}
      <div>
        <label className="label mb-3">Protection Level</label>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {['light', 'standard', 'maximum', 'custom'].map((presetName) => {
            const preset = ANTI_SHADOWBAN_PRESETS.find(p => p.name === presetName)
            const isSelected = localSettings.preset === presetName
            
            return (
              <button
                key={presetName}
                onClick={() => handlePresetChange(presetName as any)}
                className={`
                  relative p-4 rounded-lg border-2 transition-all text-left
                  ${isSelected 
                    ? 'border-gray-900 dark:border-dark-100 bg-gray-900/5 dark:bg-dark-100/10' 
                    : 'border-gray-200 dark:border-dark-700 hover:border-gray-300 dark:hover:border-dark-600'
                  }
                `}
              >
                <div className="font-medium text-sm text-gray-900 dark:text-dark-100 capitalize">
                  {presetName}
                </div>
                <div className="text-xs text-gray-500 dark:text-dark-400 mt-1">
                  {presetName === 'custom' 
                    ? 'Configure manually' 
                    : preset?.description || 'Custom configuration'
                  }
                </div>
                {isSelected && (
                  <div className="absolute top-2 right-2 w-2 h-2 bg-gray-900 dark:bg-dark-100 rounded-full" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Fine-grained Controls */}
      {localSettings.preset === 'custom' && (
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-dark-700">
          {/* Metadata Section */}
          <div className="space-y-3">
            <button
              onClick={() => toggleSection('metadata')}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-gray-600 dark:text-dark-300" />
                <span className="text-sm font-medium text-gray-900 dark:text-dark-100">
                  Device Metadata
                </span>
              </div>
              {expandedSections.has('metadata') ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
            </button>
            
            {expandedSections.has('metadata') && (
              <div className="pl-6 space-y-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={localSettings.metadata.enabled}
                    onChange={(e) => updateNestedSetting(['metadata', 'enabled'], e.target.checked)}
                    className="checkbox"
                  />
                  <span className="text-sm text-gray-700 dark:text-dark-200">
                    Simulate iPhone camera metadata
                  </span>
                </label>
                
                {localSettings.metadata.enabled && (
                  <>
                    <div>
                      <label className="label text-xs">Device Model</label>
                      <select
                        value={localSettings.metadata.deviceType}
                        onChange={(e) => updateNestedSetting(['metadata', 'deviceType'], e.target.value)}
                        className="select text-sm"
                      >
                        <option value="random">Random iPhone</option>
                        {Object.keys(IPHONE_METADATA).map(device => (
                          <option key={device} value={device}>
                            {IPHONE_METADATA[device as keyof typeof IPHONE_METADATA].model}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="label text-xs">GPS Location Variance (km)</label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={localSettings.metadata.locationVariance}
                        onChange={(e) => updateNestedSetting(['metadata', 'locationVariance'], Number(e.target.value))}
                        className="input text-sm"
                      />
                      <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
                        Randomizes GPS within this radius from major cities
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Borders Section */}
          <div className="space-y-3">
            <button
              onClick={() => toggleSection('borders')}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-2">
                <Frame className="h-4 w-4 text-gray-600 dark:text-dark-300" />
                <span className="text-sm font-medium text-gray-900 dark:text-dark-100">
                  Border Randomization
                </span>
              </div>
              {expandedSections.has('borders') ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
            </button>
            
            {expandedSections.has('borders') && (
              <div className="pl-6 space-y-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={localSettings.borders.enabled}
                    onChange={(e) => updateNestedSetting(['borders', 'enabled'], e.target.checked)}
                    className="checkbox"
                  />
                  <span className="text-sm text-gray-700 dark:text-dark-200">
                    Add randomized borders
                  </span>
                </label>
                
                {localSettings.borders.enabled && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label text-xs">Min Width (px)</label>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={localSettings.borders.minWidth}
                          onChange={(e) => updateNestedSetting(['borders', 'minWidth'], Number(e.target.value))}
                          className="input text-sm"
                        />
                      </div>
                      <div>
                        <label className="label text-xs">Max Width (px)</label>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={localSettings.borders.maxWidth}
                          onChange={(e) => updateNestedSetting(['borders', 'maxWidth'], Number(e.target.value))}
                          className="input text-sm"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="label text-xs">Color Mode</label>
                      <select
                        value={localSettings.borders.colorMode}
                        onChange={(e) => updateNestedSetting(['borders', 'colorMode'], e.target.value)}
                        className="select text-sm"
                      >
                        <option value="random">Random Colors</option>
                        <option value="sampled">Sample from Image Edges</option>
                        <option value="custom">Custom Colors</option>
                      </select>
                    </div>
                    
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={localSettings.borders.asymmetric}
                        onChange={(e) => updateNestedSetting(['borders', 'asymmetric'], e.target.checked)}
                        className="checkbox"
                      />
                      <span className="text-sm text-gray-700 dark:text-dark-200">
                        Different width on each edge
                      </span>
                    </label>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Fractures Section */}
          <div className="space-y-3">
            <button
              onClick={() => toggleSection('fractures')}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-gray-600 dark:text-dark-300" />
                <span className="text-sm font-medium text-gray-900 dark:text-dark-100">
                  Hairline Fractures
                </span>
              </div>
              {expandedSections.has('fractures') ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
            </button>
            
            {expandedSections.has('fractures') && (
              <div className="pl-6 space-y-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={localSettings.fractures.enabled}
                    onChange={(e) => updateNestedSetting(['fractures', 'enabled'], e.target.checked)}
                    className="checkbox"
                  />
                  <span className="text-sm text-gray-700 dark:text-dark-200">
                    Simulate screen fractures
                  </span>
                </label>
                
                {localSettings.fractures.enabled && (
                  <>
                    <div>
                      <label className="label text-xs">Intensity</label>
                      <select
                        value={localSettings.fractures.intensity}
                        onChange={(e) => updateNestedSetting(['fractures', 'intensity'], e.target.value)}
                        className="select text-sm"
                      >
                        <option value="subtle">Subtle</option>
                        <option value="light">Light</option>
                        <option value="medium">Medium</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="label text-xs">Number of Fractures</label>
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={localSettings.fractures.count}
                        onChange={(e) => updateNestedSetting(['fractures', 'count'], Number(e.target.value))}
                        className="input text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="label text-xs">Opacity (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={localSettings.fractures.opacity}
                        onChange={(e) => updateNestedSetting(['fractures', 'opacity'], Number(e.target.value))}
                        className="input text-sm"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Advanced Modifications */}
          <div className="space-y-3">
            <button
              onClick={() => toggleSection('advanced')}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-gray-600 dark:text-dark-300" />
                <span className="text-sm font-medium text-gray-900 dark:text-dark-100">
                  Advanced Modifications
                </span>
              </div>
              {expandedSections.has('advanced') ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
            </button>
            
            {expandedSections.has('advanced') && (
              <div className="pl-6 space-y-4">
                {/* Micro Noise */}
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={localSettings.microNoise.enabled}
                      onChange={(e) => updateNestedSetting(['microNoise', 'enabled'], e.target.checked)}
                      className="checkbox"
                    />
                    <span className="text-sm text-gray-700 dark:text-dark-200">
                      Micro-noise injection
                    </span>
                  </label>
                  {localSettings.microNoise.enabled && (
                    <div>
                      <label className="label text-xs">Intensity (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={localSettings.microNoise.intensity}
                        onChange={(e) => updateNestedSetting(['microNoise', 'intensity'], Number(e.target.value))}
                        className="input text-sm"
                      />
                    </div>
                  )}
                </div>
                
                {/* Color Shift */}
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={localSettings.colorShift.enabled}
                      onChange={(e) => updateNestedSetting(['colorShift', 'enabled'], e.target.checked)}
                      className="checkbox"
                    />
                    <span className="text-sm text-gray-700 dark:text-dark-200">
                      Subtle color variations
                    </span>
                  </label>
                  {localSettings.colorShift.enabled && (
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="label text-xs">Hue (°)</label>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={localSettings.colorShift.hueVariance}
                          onChange={(e) => updateNestedSetting(['colorShift', 'hueVariance'], Number(e.target.value))}
                          className="input text-sm"
                        />
                      </div>
                      <div>
                        <label className="label text-xs">Saturation (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={localSettings.colorShift.saturationVariance}
                          onChange={(e) => updateNestedSetting(['colorShift', 'saturationVariance'], Number(e.target.value))}
                          className="input text-sm"
                        />
                      </div>
                      <div>
                        <label className="label text-xs">Lightness (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={localSettings.colorShift.lightnessVariance}
                          onChange={(e) => updateNestedSetting(['colorShift', 'lightnessVariance'], Number(e.target.value))}
                          className="input text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Compression */}
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={localSettings.compression.enabled}
                      onChange={(e) => updateNestedSetting(['compression', 'enabled'], e.target.checked)}
                      className="checkbox"
                    />
                    <span className="text-sm text-gray-700 dark:text-dark-200">
                      Variable JPEG compression
                    </span>
                  </label>
                  {localSettings.compression.enabled && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label text-xs">Min Quality</label>
                        <input
                          type="number"
                          min="70"
                          max="95"
                          value={localSettings.compression.qualityMin}
                          onChange={(e) => updateNestedSetting(['compression', 'qualityMin'], Number(e.target.value))}
                          className="input text-sm"
                        />
                      </div>
                      <div>
                        <label className="label text-xs">Max Quality</label>
                        <input
                          type="number"
                          min="80"
                          max="100"
                          value={localSettings.compression.qualityMax}
                          onChange={(e) => updateNestedSetting(['compression', 'qualityMax'], Number(e.target.value))}
                          className="input text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Invisible Watermark */}
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={localSettings.invisibleWatermark.enabled}
                      onChange={(e) => updateNestedSetting(['invisibleWatermark', 'enabled'], e.target.checked)}
                      className="checkbox"
                    />
                    <span className="text-sm text-gray-700 dark:text-dark-200">
                      Invisible watermarking
                    </span>
                  </label>
                  {localSettings.invisibleWatermark.enabled && (
                    <div>
                      <label className="label text-xs">Watermark Data</label>
                      <input
                        type="text"
                        value={localSettings.invisibleWatermark.data}
                        onChange={(e) => updateNestedSetting(['invisibleWatermark', 'data'], e.target.value)}
                        placeholder="Unique identifier (auto-generated if empty)"
                        className="input text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* File Handling */}
          <div className="space-y-3">
            <button
              onClick={() => toggleSection('file')}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-2">
                <FileImage className="h-4 w-4 text-gray-600 dark:text-dark-300" />
                <span className="text-sm font-medium text-gray-900 dark:text-dark-100">
                  File Handling
                </span>
              </div>
              {expandedSections.has('file') ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
            </button>
            
            {expandedSections.has('file') && (
              <div className="pl-6 space-y-4">
                <div>
                  <label className="label text-xs">File Naming Pattern</label>
                  <select
                    value={localSettings.fileNaming.pattern}
                    onChange={(e) => updateNestedSetting(['fileNaming', 'pattern'], e.target.value)}
                    className="select text-sm"
                  >
                    <option value="iphone">iPhone Default (IMG_XXXX)</option>
                    <option value="sequential">Sequential Numbers</option>
                    <option value="random">Random Names</option>
                  </select>
                </div>
                
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={localSettings.processingDelay.enabled}
                      onChange={(e) => updateNestedSetting(['processingDelay', 'enabled'], e.target.checked)}
                      className="checkbox"
                    />
                    <span className="text-sm text-gray-700 dark:text-dark-200">
                      Natural processing delays
                    </span>
                  </label>
                  {localSettings.processingDelay.enabled && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label text-xs">Min Delay (ms)</label>
                        <input
                          type="number"
                          min="0"
                          max="5000"
                          value={localSettings.processingDelay.minMs}
                          onChange={(e) => updateNestedSetting(['processingDelay', 'minMs'], Number(e.target.value))}
                          className="input text-sm"
                        />
                      </div>
                      <div>
                        <label className="label text-xs">Max Delay (ms)</label>
                        <input
                          type="number"
                          min="0"
                          max="10000"
                          value={localSettings.processingDelay.maxMs}
                          onChange={(e) => updateNestedSetting(['processingDelay', 'maxMs'], Number(e.target.value))}
                          className="input text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex gap-3">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-medium mb-1">Anti-shadowban protection</p>
            <p className="text-xs leading-relaxed">
              These features add subtle variations to each generated image, making them appear more authentic and reducing the risk of automated detection. Each carousel variation will have unique characteristics while maintaining visual consistency.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 