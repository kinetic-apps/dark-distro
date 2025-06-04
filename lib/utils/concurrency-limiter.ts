/**
 * Concurrency limiter to control parallel execution of async operations
 */
export class ConcurrencyLimiter {
  private running = 0
  private queue: Array<() => void> = []

  constructor(private maxConcurrent: number) {}

  async acquire(): Promise<void> {
    if (this.running >= this.maxConcurrent) {
      await new Promise<void>(resolve => {
        this.queue.push(resolve)
      })
    }
    this.running++
  }

  release(): void {
    this.running--
    const next = this.queue.shift()
    if (next) {
      next()
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await fn()
    } finally {
      this.release()
    }
  }
}

/**
 * Process an array of items in parallel with concurrency limit
 */
export async function processInParallel<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  maxConcurrent: number = 5
): Promise<Array<{ index: number; result?: R; error?: Error }>> {
  const limiter = new ConcurrencyLimiter(maxConcurrent)
  
  const promises = items.map((item, index) => 
    limiter.run(async () => {
      try {
        const result = await processor(item, index)
        return { index, result }
      } catch (error) {
        return { index, error: error instanceof Error ? error : new Error(String(error)) }
      }
    })
  )
  
  return Promise.all(promises)
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000,
  maxDelay: number = 30000
): Promise<T> {
  let lastError: Error
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt === maxRetries - 1) {
        throw lastError
      }
      
      const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay)
      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms delay. Error: ${lastError.message}`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError!
}