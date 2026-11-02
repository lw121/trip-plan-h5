import { distanceMeters, type LngLat } from './geo'

export interface ParsedGroup {
  title: string
  names: string[]
}

export interface ParsedPlaces {
  grouped: boolean
  groups: ParsedGroup[]
  note: string
}

const HEADER =
  /^(?:第\s*([0-9０-９]+|[一二三四五六七八九十两]+)\s*天|D(?:ay)?\s*([0-9]+))\s*[:：\-—.、]?\s*(.*)$/i

export function parsePlaceText(text: string): ParsedPlaces {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const hasHeader = lines.some((line) => matchHeader(line.trim()))
  if (hasHeader) {
    const groups = uniqueTitles(parseByHeaders(lines))
    const count = groups.reduce((sum, group) => sum + group.names.length, 0)
    return {
      grouped: true,
      groups,
      note: groups.length
        ? `已按「第N天」标题分成 ${groups.length} 天、${count} 个地点`
        : '没有识别到地点',
    }
  }

  const blocks = parseBlocks(lines)
  if (blocks.length >= 2) {
    const groups = uniqueTitles(
      blocks.map((names, index) => ({ title: `第${index + 1}天`, names })),
    )
    const count = groups.reduce((sum, group) => sum + group.names.length, 0)
    return {
      grouped: true,
      groups,
      note: `已按空行分成 ${groups.length} 天、${count} 个地点`,
    }
  }

  const names = blocks[0] ?? []
  return {
    grouped: false,
    groups: names.length ? [{ title: '', names }] : [],
    note: names.length ? `共 ${names.length} 个地点，确认后按顺序分天` : '没有识别到地点',
  }
}

export function splitPlaces<T>(items: T[], options: { days?: number | null; perDay?: number }): T[][] {
  if (!items.length) return []
  const perDay = Math.max(1, Math.floor(options.perDay || 4))
  const requested = options.days && options.days > 0 ? Math.floor(options.days) : Math.ceil(items.length / perDay)
  const dayCount = Math.min(Math.max(1, requested), items.length)
  const base = Math.floor(items.length / dayCount)
  let extra = items.length % dayCount
  const days: T[][] = []
  let index = 0
  for (let day = 0; day < dayCount; day += 1) {
    const size = base + (extra > 0 ? 1 : 0)
    if (extra > 0) extra -= 1
    days.push(items.slice(index, index + size))
    index += size
  }
  return days
}

export function orderByNearest<T extends LngLat>(places: T[]): T[] {
  if (places.length <= 2) return places.slice()
  const remaining = places.slice(1)
  const ordered: T[] = [places[0]]
  while (remaining.length) {
    const current = ordered[ordered.length - 1]
    let bestIndex = 0
    let bestDistance = Number.POSITIVE_INFINITY
    remaining.forEach((place, index) => {
      const distance = distanceMeters(current, place)
      if (distance < bestDistance) {
        bestDistance = distance
        bestIndex = index
      }
    })
    ordered.push(remaining.splice(bestIndex, 1)[0])
  }
  return ordered
}

export function daySizePreview(count: number, options: { days?: number | null; perDay?: number }): number[] {
  return splitPlaces(Array.from({ length: count }, (_, index) => index), options).map((day) => day.length)
}

function parseByHeaders(lines: string[]): ParsedGroup[] {
  const groups: ParsedGroup[] = []
  let current: ParsedGroup | null = null
  lines.forEach((raw) => {
    const line = raw.trim()
    if (!line || isDivider(line)) return
    const header = matchHeader(line)
    if (header) {
      current = { title: header.title, names: [] }
      groups.push(current)
      explodeLine(header.rest).forEach((name) => current?.names.push(name))
      return
    }
    if (!current) {
      current = { title: '第1天', names: [] }
      groups.push(current)
    }
    explodeLine(line).forEach((name) => current?.names.push(name))
  })
  return groups.filter((group) => group.names.length)
}

function parseBlocks(lines: string[]): string[][] {
  const blocks: string[][] = []
  let current: string[] = []
  const pushCurrent = () => {
    if (current.length) blocks.push(current)
    current = []
  }
  lines.forEach((raw) => {
    const line = raw.trim()
    if (!line || isDivider(line)) {
      pushCurrent()
      return
    }
    explodeLine(line).forEach((name) => current.push(name))
  })
  pushCurrent()
  return blocks
}

function matchHeader(line: string): { title: string; rest: string } | null {
  const matched = HEADER.exec(line)
  if (!matched) return null
  const rawNumber = normalizeDigits(matched[1] || matched[2] || '')
  const dayNumber = parseDayNumber(rawNumber)
  return {
    title: dayNumber ? `第${dayNumber}天` : '',
    rest: (matched[3] || '').trim(),
  }
}

function uniqueTitles(groups: ParsedGroup[]): ParsedGroup[] {
  const used = new Set<string>()
  return groups.map((group, index) => {
    let title = group.title || `第${index + 1}天`
    if (used.has(title)) {
      let number = index + 2
      while (used.has(`第${number}天`)) number += 1
      title = `第${number}天`
    }
    used.add(title)
    return { ...group, title }
  })
}

function explodeLine(line: string): string[] {
  const cleaned = cleanLine(line)
  if (!cleaned) return []
  if (/[、；;]/.test(cleaned)) {
    const parts = cleaned
      .split(/[、；;]/)
      .map((part) => part.trim())
      .filter(Boolean)
    if (parts.length >= 2 && parts.every((part) => part.length <= 30)) return parts
  }
  return [cleaned]
}

function cleanLine(line: string): string {
  return line
    .replace(/^[\s\-*•·]+/, '')
    .replace(/^\d+\s*[.、,，)）\]]\s*/, '')
    .trim()
}

function isDivider(line: string): boolean {
  return /^[-—]{3,}$/.test(line)
}

function normalizeDigits(value: string): string {
  return value.replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xff10 + 0x30))
}

function parseDayNumber(value: string): number | null {
  if (/^\d+$/.test(value)) {
    const number = Number(value)
    return number > 0 ? number : null
  }
  const digit: Record<string, number> = {
    零: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  }
  if (value === '十') return 10
  const ten = /^十([一二三四五六七八九])$/.exec(value)
  if (ten) return 10 + digit[ten[1]]
  const tens = /^([一二三四五六七八九])十([一二三四五六七八九])?$/.exec(value)
  if (tens) return digit[tens[1]] * 10 + (tens[2] ? digit[tens[2]] : 0)
  if (value.length === 1 && digit[value]) return digit[value]
  return null
}
