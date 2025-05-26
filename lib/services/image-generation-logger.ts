import { createClient } from '@/lib/supabase/server'
import { createClient as createBrowserClient } from '@/lib/supabase/client'

export type LogLevel = 'info' | 'warning' | 'error' | 'success'
export type LogStep = 
  | 'initialization' 
  | 'validation'
  | 'base_generation' 
  | 'variant_creation' 
  | 'upload' 
  | 'processing'
  | 'completion'
  | 'cleanup'

interface LogDetails {
  [key: string]: any
}

export class ImageGenerationLogger {
  static async log(
    jobId: string,
    userId: string,
    level: LogLevel,
    step: LogStep,
    message: string,
    details?: LogDetails
  ) {
    try {
      const supabase = await createClient()
      
      await supabase
        .from('image_generation_logs')
        .insert({
          job_id: jobId,
          user_id: userId,
          level,
          step,
          message,
          details
        })
    } catch (error) {
      console.error('Failed to log image generation event:', error)
    }
  }

  static async info(jobId: string, userId: string, step: LogStep, message: string, details?: LogDetails) {
    await this.log(jobId, userId, 'info', step, message, details)
  }

  static async warning(jobId: string, userId: string, step: LogStep, message: string, details?: LogDetails) {
    await this.log(jobId, userId, 'warning', step, message, details)
  }

  static async error(jobId: string, userId: string, step: LogStep, message: string, details?: LogDetails) {
    await this.log(jobId, userId, 'error', step, message, details)
  }

  static async success(jobId: string, userId: string, step: LogStep, message: string, details?: LogDetails) {
    await this.log(jobId, userId, 'success', step, message, details)
  }
}

// Client-side logger for browser use
export class ImageGenerationLoggerClient {
  static async log(
    jobId: string,
    userId: string,
    level: LogLevel,
    step: LogStep,
    message: string,
    details?: LogDetails
  ) {
    try {
      const supabase = createBrowserClient()
      
      await supabase
        .from('image_generation_logs')
        .insert({
          job_id: jobId,
          user_id: userId,
          level,
          step,
          message,
          details
        })
    } catch (error) {
      console.error('Failed to log image generation event:', error)
    }
  }

  static async info(jobId: string, userId: string, step: LogStep, message: string, details?: LogDetails) {
    await this.log(jobId, userId, 'info', step, message, details)
  }

  static async warning(jobId: string, userId: string, step: LogStep, message: string, details?: LogDetails) {
    await this.log(jobId, userId, 'warning', step, message, details)
  }

  static async error(jobId: string, userId: string, step: LogStep, message: string, details?: LogDetails) {
    await this.log(jobId, userId, 'error', step, message, details)
  }

  static async success(jobId: string, userId: string, step: LogStep, message: string, details?: LogDetails) {
    await this.log(jobId, userId, 'success', step, message, details)
  }
} 