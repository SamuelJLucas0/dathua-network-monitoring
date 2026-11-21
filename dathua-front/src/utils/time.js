const UNITS = [
  ['año', 60 * 60 * 24 * 365],
  ['mes', 60 * 60 * 24 * 30],
  ['día', 60 * 60 * 24],
  ['hora', 60 * 60],
  ['minuto', 60],
]

export function formatRelativeTime(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'hace un momento'

  for (const [label, secondsInUnit] of UNITS) {
    const value = Math.floor(seconds / secondsInUnit)
    if (value >= 1) return `hace ${value} ${label}${value > 1 ? 's' : ''}`
  }
  return 'hace un momento'
}
