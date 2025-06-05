'use client'

import { useState, useEffect } from 'react'
import { X, Tag, Plus, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useNotification } from '@/lib/context/notification-context'

interface TagEditorModalProps {
  isOpen: boolean
  onClose: () => void
  accountId: string
  currentTags: string[]
  onUpdate: (tags: string[]) => void
}

export default function TagEditorModal({ 
  isOpen, 
  onClose, 
  accountId, 
  currentTags, 
  onUpdate 
}: TagEditorModalProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>(currentTags)
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [newTagInput, setNewTagInput] = useState('')
  const [showNewTagInput, setShowNewTagInput] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  const supabase = createClient()
  const { notify } = useNotification()

  useEffect(() => {
    if (isOpen) {
      setSelectedTags(currentTags)
      loadAvailableTags()
    }
  }, [isOpen, currentTags])

  const loadAvailableTags = async () => {
    const { data: phones } = await supabase
      .from('phones')
      .select('tags')
      .not('tags', 'is', null)

    const allTags = new Set<string>()
    phones?.forEach(phone => {
      if (Array.isArray(phone.tags)) {
        phone.tags.forEach(tag => allTags.add(tag))
      }
    })
    
    setAvailableTags(Array.from(allTags).sort())
  }

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag))
    } else {
      setSelectedTags([...selectedTags, tag])
    }
  }

  const addNewTag = () => {
    const tag = newTagInput.trim()
    if (tag && !availableTags.includes(tag)) {
      setAvailableTags([...availableTags, tag].sort())
      setSelectedTags([...selectedTags, tag])
      setNewTagInput('')
      setShowNewTagInput(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const resp = await fetch('/api/phones/update-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, tags: selectedTags })
      })
      
      if (!resp.ok) {
        const err = await resp.json()
        throw new Error(err.error || 'Failed to update tags')
      }
      
      notify('success', 'Tags updated successfully')
      onUpdate(selectedTags)
      onClose()
    } catch (e) {
      notify('error', e instanceof Error ? e.message : 'Failed to update tags')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-850 rounded-lg shadow-xl w-96 max-h-[600px] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-dark-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100 flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Edit Tags
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-dark-700 rounded transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tag List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {availableTags.map(tag => (
              <label
                key={tag}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-800 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedTags.includes(tag)}
                  onChange={() => toggleTag(tag)}
                  className="w-4 h-4 text-gray-900 dark:text-dark-100 bg-gray-100 dark:bg-dark-700 border-gray-300 dark:border-dark-600 rounded focus:ring-2 focus:ring-gray-500 dark:focus:ring-dark-400"
                />
                <span className="flex-1 text-sm text-gray-700 dark:text-dark-300">{tag}</span>
                {selectedTags.includes(tag) && (
                  <Check className="h-4 w-4 text-green-500" />
                )}
              </label>
            ))}
          </div>

          {/* Add New Tag */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-700">
            {showNewTagInput ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addNewTag()
                    } else if (e.key === 'Escape') {
                      setShowNewTagInput(false)
                      setNewTagInput('')
                    }
                  }}
                  placeholder="New tag name..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 focus:ring-2 focus:ring-gray-500 dark:focus:ring-dark-400 focus:border-transparent"
                  autoFocus
                />
                <button
                  onClick={addNewTag}
                  className="px-3 py-2 text-sm bg-gray-900 dark:bg-dark-100 text-white dark:text-dark-900 rounded-lg hover:bg-gray-800 dark:hover:bg-dark-200 transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowNewTagInput(false)
                    setNewTagInput('')
                  }}
                  className="px-3 py-2 text-sm text-gray-600 dark:text-dark-400 hover:text-gray-900 dark:hover:text-dark-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewTagInput(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-dark-400 hover:text-gray-900 dark:hover:text-dark-100 border border-dashed border-gray-300 dark:border-dark-600 rounded-lg hover:border-gray-400 dark:hover:border-dark-500 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add New Tag
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-dark-700 flex items-center justify-between">
          <div className="text-sm text-gray-500 dark:text-dark-400">
            {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''} selected
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-dark-400 hover:text-gray-900 dark:hover:text-dark-100 transition-colors"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm bg-gray-900 dark:bg-dark-100 text-white dark:text-dark-900 rounded-lg hover:bg-gray-800 dark:hover:bg-dark-200 transition-colors disabled:opacity-50"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 