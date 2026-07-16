export class Semaphore {
  private active = 0
  private waiting: Array<() => void> = []
  constructor(private limit: number) {}

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) await new Promise<void>((resolve) => this.waiting.push(resolve))
    this.active++
    try { return await operation() } finally {
      this.active--
      this.waiting.shift()?.()
    }
  }
}
