import type { Config } from './config'

const levels = { debug: 10, info: 20, warn: 30, error: 40 }
export function createLogger(config: Config) {
  return (level: keyof typeof levels, event: string, data: Record<string, unknown> = {}) => {
    if (levels[level] < levels[config.logLevel]) return
    console[level === 'debug' ? 'log' : level](JSON.stringify({ time: new Date().toISOString(), level, event, ...data }))
  }
}
