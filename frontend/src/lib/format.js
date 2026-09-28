const scoreFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })

export function formatScore(score) {
  return score == null ? '-' : scoreFormat.format(score)
}

export function verdictFor(score, subject = 'answer') {
  if (score == null) return { label: 'Not scored', tone: 'neutral' }
  if (score >= 7) return { label: `Strong ${subject}`, tone: 'good' }
  if (score >= 4.5) return { label: 'Getting there', tone: 'fair' }
  return { label: 'Needs work', tone: 'low' }
}

export function formatClock(seconds) {
  const m = Math.floor(seconds / 60)
  const s = String(seconds % 60).padStart(2, '0')
  return `${m}:${s}`
}

export function firstName(fullName) {
  return (fullName ?? '').trim().split(/\s+/)[0] ?? ''
}

export function possessive(name) {
  if (!name) return 'your'
  return name.endsWith('s') ? `${name}’` : `${name}’s`
}
