'use client'

import { useState } from 'react'
import { X, Activity, Info } from 'lucide-react'

interface WarmupConfigModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (config: WarmupConfig) => void
  selectedCount: number
  isLoading?: boolean
}

export interface WarmupConfig {
  duration_minutes: number
  action: 'browse video' | 'search video' | 'search profile'
  keywords?: string[]
}

const NICHE_KEYWORDS: Record<string, string> = {
  fitness: 'fitness, workout, gym, health, exercise, training, yoga, nutrition',
  cooking: 'cooking, recipes, food, chef, kitchen, meal prep, baking, cuisine',
  tech: 'technology, gadgets, tech review, innovation, AI, coding, software, apps',
  fashion: 'fashion, style, outfit, clothing, trends, ootd, designer, streetwear',
  gaming: 'gaming, gamer, gameplay, esports, video games, streaming, twitch, console',
  beauty: 'beauty, makeup, skincare, cosmetics, tutorial, routine, hairstyle, nails',
  travel: 'travel, vacation, destination, adventure, explore, tourism, wanderlust, backpacking',
  music: 'music, songs, artist, concert, playlist, musician, band, producer',
  comedy: 'comedy, funny, humor, jokes, memes, entertainment, standup, pranks',
  education: 'education, learning, tutorial, howto, tips, knowledge, study, teaching',
  pets: 'pets, dogs, cats, animals, puppy, kitten, pet care, animal lover',
  art: 'art, drawing, painting, artist, creative, artwork, illustration, design',
  sports: 'sports, athlete, training, football, basketball, soccer, fitness, workout',
  business: 'business, entrepreneur, startup, marketing, finance, investing, money, success',
  lifestyle: 'lifestyle, daily routine, vlog, life hacks, motivation, wellness, mindfulness',
  dance: 'dance, dancing, choreography, dancer, tiktok dance, moves, performance',
  diy: 'diy, crafts, handmade, tutorial, home improvement, creative, projects',
  photography: 'photography, photo, camera, photographer, editing, photoshoot, portrait'
}

export function WarmupConfigModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  selectedCount,
  isLoading = false 
}: WarmupConfigModalProps) {
  const [duration, setDuration] = useState('30')
  const [action, setAction] = useState<'browse video' | 'search video' | 'search profile'>('browse video')
  const [keywords, setKeywords] = useState('')
  const [selectedNiche, setSelectedNiche] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  if (!isOpen) return null

  const handleConfirm = () => {
    const config: WarmupConfig = {
      duration_minutes: parseInt(duration),
      action
    }

    if (action !== 'browse video' && keywords.trim()) {
      config.keywords = keywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0)
    }

    onConfirm(config)
  }

  const handleNicheChange = (niche: string) => {
    setSelectedNiche(niche)
    if (niche && NICHE_KEYWORDS[niche]) {
      setKeywords(NICHE_KEYWORDS[niche])
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Configure Bulk Warmup
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Starting warmup for {selectedCount} profile{selectedCount !== 1 ? 's' : ''}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Action Type */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Warmup Strategy
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={() => {
                  setAction('browse video')
                  setKeywords('')
                  setSelectedNiche('')
                }}
                className={`p-3 rounded-lg border-2 transition-all ${
                  action === 'browse video'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                }`}
              >
                <div className="text-left">
                  <p className="font-medium text-sm text-gray-900 dark:text-gray-100">Random Browse</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Natural browsing behavior
                  </p>
                </div>
              </button>
              
              <button
                onClick={() => setAction('search video')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  action === 'search video'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                }`}
              >
                <div className="text-left">
                  <p className="font-medium text-sm text-gray-900 dark:text-gray-100">Search Videos</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Target specific content
                  </p>
                </div>
              </button>
              
              <button
                onClick={() => setAction('search profile')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  action === 'search profile'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                }`}
              >
                <div className="text-left">
                  <p className="font-medium text-sm text-gray-900 dark:text-gray-100">Search Profiles</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Find niche creators
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Duration
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
            >
              <option value="10">10 minutes (Quick test)</option>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes (Recommended)</option>
              <option value="45">45 minutes</option>
              <option value="60">1 hour</option>
              <option value="90">1.5 hours</option>
              <option value="120">2 hours (Extended)</option>
              <option value="180">3 hours</option>
              <option value="240">4 hours (Maximum)</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Longer durations help build more authentic engagement patterns
            </p>
          </div>

          {/* Niche/Keywords - Only for search actions */}
          {action !== 'browse video' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Select Niche
                </label>
                <select
                  value={selectedNiche}
                  onChange={(e) => handleNicheChange(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Custom Keywords</option>
                  <optgroup label="Popular Niches">
                    <option value="fitness">Fitness & Health</option>
                    <option value="cooking">Cooking & Food</option>
                    <option value="tech">Technology</option>
                    <option value="fashion">Fashion & Style</option>
                    <option value="gaming">Gaming</option>
                    <option value="beauty">Beauty & Makeup</option>
                  </optgroup>
                  <optgroup label="Entertainment">
                    <option value="comedy">Comedy</option>
                    <option value="music">Music</option>
                    <option value="dance">Dance</option>
                    <option value="sports">Sports</option>
                  </optgroup>
                  <optgroup label="Lifestyle">
                    <option value="travel">Travel</option>
                    <option value="pets">Pets & Animals</option>
                    <option value="lifestyle">Lifestyle & Vlogs</option>
                    <option value="diy">DIY & Crafts</option>
                  </optgroup>
                  <optgroup label="Professional">
                    <option value="business">Business & Finance</option>
                    <option value="education">Education</option>
                    <option value="art">Art & Design</option>
                    <option value="photography">Photography</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Keywords {action === 'search video' ? '(for video search)' : '(for profile search)'}
                </label>
                <textarea
                  placeholder={action === 'search video' 
                    ? "e.g., fitness, workout, gym, health, exercise" 
                    : "e.g., fitness coach, personal trainer, yoga instructor"}
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Separate keywords with commas. More specific keywords lead to better targeting.
                </p>
              </div>
            </>
          )}

          {/* Advanced Options */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
            >
              <Info className="h-4 w-4" />
              {showAdvanced ? 'Hide' : 'Show'} Advanced Tips
            </button>
            
            {showAdvanced && (
              <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Warmup Best Practices:</h4>
                <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                  <li>• Start with shorter durations (15-30 min) for new accounts</li>
                  <li>• Use random browsing for the first few warmup sessions</li>
                  <li>• Gradually introduce targeted searches as accounts mature</li>
                  <li>• Mix different niches to appear more natural</li>
                  <li>• Run warmup at different times of day</li>
                  <li>• Avoid using the same keywords repeatedly</li>
                </ul>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Configuration Summary</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Profiles:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{selectedCount}</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{duration} minutes</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Strategy:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                  {action === 'browse video' ? 'Random Browse' : 
                   action === 'search video' ? 'Video Search' : 'Profile Search'}
                </span>
              </div>
              {action !== 'browse video' && keywords && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Keywords:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                    {keywords.split(',').filter(k => k.trim()).length} terms
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading || (action !== 'browse video' && !keywords.trim())}
              className="flex-1 btn-primary"
            >
              {isLoading ? 'Starting Warmup...' : `Start Warmup for ${selectedCount} Profiles`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 