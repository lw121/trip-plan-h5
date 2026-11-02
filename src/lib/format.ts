export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return ''
  if (meters < 1000) return `${Math.round(meters)} 米`
  const digits = meters < 10000 ? 1 : 0
  return `${(meters / 1000).toFixed(digits)} 公里`
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`
}

export function formatUpdated(timestamp: number, now = Date.now()): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
  const dayDiff = Math.round((startOfDay(new Date(now)) - startOfDay(date)) / 86400000)
  if (dayDiff === 0) return '今天'
  if (dayDiff === 1) return '昨天'
  if (date.getFullYear() === new Date(now).getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

export function tripStatsText(dayCount: number, placeCount: number): string {
  return `${dayCount} 天 · ${placeCount} 个地点`
}
