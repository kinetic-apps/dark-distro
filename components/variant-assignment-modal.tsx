'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Send, Image as ImageIcon } from 'lucide-react'

interface VariantAssignmentModalProps {
  profileId: string
  profileName: string
  onClose: () => void
  onAssign: (variantId: string) => void
}

interface CarouselVariant {
  id: string
  variant_id: string
  variant_index: number
  slide_count: number
  status: string
  created_at: string
  job: {
    name: string
    template_name: string
  }
  slides: Array<{
    slide_order: number
    image_url: string
  }>
}

export function VariantAssignmentModal({ 
  profileId, 
  profileName, 
  onClose, 
  onAssign 
}: VariantAssignmentModalProps) {
  const [variants, setVariants] = useState<CarouselVariant[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null)
  const [assigning, setAssigning] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchAvailableVariants()
  }, [])

  const fetchAvailableVariants = async () => {
    setLoading(true)
    
    const { data, error } = await supabase
      .from('carousel_variants')
      .select(`
        *,
        job:image_generation_jobs!job_id (
          name,
          template_name
        ),
        slides:variant_slides (
          slide_order,
          image_url
        )
      `)
      .eq('status', 'ready')
      .is('assigned_profile_id', null)
      .order('created_at', { ascending: false })
      .limit(20)

    if (!error && data) {
      setVariants(data as any)
    }
    
    setLoading(false)
  }

  const handleAssign = async () => {
    if (!selectedVariant) return
    
    setAssigning(true)
    
    // Update variant status
    const { error } = await supabase
      .from('carousel_variants')
      .update({
        status: 'assigned',
        assigned_profile_id: profileId,
        assigned_at: new Date().toISOString()
      })
      .eq('id', selectedVariant)

    if (!error) {
      onAssign(selectedVariant)
      onClose()
    } else {
      console.error('Error assigning variant:', error)
    }
    
    setAssigning(false)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-850 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-dark-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
              Assign Carousel to {profileName}
            </h2>
            <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
              Select a carousel variant to assign to this profile
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:text-dark-500 dark:hover:text-dark-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          {loading ? (
            <div className="text-center py-12">
              <div className="text-gray-400 dark:text-dark-500">Loading available variants...</div>
            </div>
          ) : variants.length === 0 ? (
            <div className="text-center py-12">
              <ImageIcon className="h-12 w-12 text-gray-400 dark:text-dark-500 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-dark-400">No available variants</p>
              <p className="text-sm text-gray-400 dark:text-dark-500 mt-2">
                All variants have been assigned or posted
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {variants.map((variant) => (
                <div
                  key={variant.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedVariant === variant.id
                      ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
                      : 'border-gray-200 hover:border-gray-300 dark:border-dark-700 dark:hover:border-dark-600'
                  }`}
                  onClick={() => setSelectedVariant(variant.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-dark-100">
                        {variant.job?.name || 'Untitled Job'}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-dark-400">
                        Variant {variant.variant_index + 1} • {variant.slide_count} slides
                      </p>
                      <p className="text-xs text-gray-400 dark:text-dark-500 mt-1">
                        Template: {variant.job?.template_name || 'Unknown'}
                      </p>
                    </div>
                    <input
                      type="radio"
                      checked={selectedVariant === variant.id}
                      onChange={() => setSelectedVariant(variant.id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 dark:text-blue-400 dark:focus:ring-blue-400"
                    />
                  </div>

                  {/* Slide thumbnails */}
                  <div className="grid grid-cols-4 gap-1">
                    {variant.slides
                      ?.sort((a, b) => a.slide_order - b.slide_order)
                      .slice(0, 4)
                      .map((slide, index) => (
                        <div
                          key={index}
                          className="aspect-[9/16] bg-gray-100 dark:bg-dark-800 rounded overflow-hidden"
                        >
                          <img
                            src={slide.image_url}
                            alt={`Slide ${slide.slide_order}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    {variant.slide_count > 4 && (
                      <div className="aspect-[9/16] bg-gray-100 dark:bg-dark-800 rounded flex items-center justify-center">
                        <span className="text-sm text-gray-500 dark:text-dark-400">
                          +{variant.slide_count - 4}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-dark-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedVariant || assigning}
            className="btn-primary"
          >
            <Send className="h-4 w-4 mr-2" />
            {assigning ? 'Assigning...' : 'Assign Variant'}
          </button>
        </div>
      </div>
    </div>
  )
} 