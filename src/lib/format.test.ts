import { describe, expect, it } from 'vitest'
import { formatDistance, formatDuration, formatUpdated } from './format'

describe('formatters', () => {
  it('formats distance and duration in Chinese units', () => {
    expect(formatDistance(860)).toBe('860 米')
    expect(formatDistance(2400)).toBe('2.4 公里')
    expect(formatDuration(90)).toBe('2 分钟')
    expect(formatDuration(5400)).toBe('1 小时 30 分钟')
  })

  it('labels today and yesterday from a fixed clock', () => {
    const now = new Date(2026, 10, 2, 9, 0).getTime()
    expect(formatUpdated(new Date(2026, 10, 2, 8, 0).getTime(), now)).toBe('今天')
    expect(formatUpdated(new Date(2026, 10, 1, 23, 0).getTime(), now)).toBe('昨天')
    expect(formatUpdated(new Date(2026, 9, 18, 12, 0).getTime(), now)).toBe('10月18日')
  })
})
