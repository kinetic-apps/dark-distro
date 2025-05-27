import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { task_ids } = body

    if (!task_ids || !Array.isArray(task_ids)) {
      return NextResponse.json(
        { error: 'task_ids array is required' },
        { status: 400 }
      )
    }

    const result = await geelarkApi.queryTasks(task_ids)

    return NextResponse.json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Task status error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to query tasks',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
} 