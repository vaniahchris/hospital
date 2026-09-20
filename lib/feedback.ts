export type QuestionOption = {
  label: string
  icon?: string
}

export type QuestionRow = {
  id: string
  prompt: string
  question_type: 'rating' | 'choice' | 'text'
  options: QuestionOption[]
  sort_order: number
  is_active: boolean
  is_required: boolean
}

export type ResponseRow = {
  id: string
  date: string
  care: string
  staff: string
  wait: string
  recommend: string
  score: number
  comment: string
}

const ratingScores: Record<string, number> = {
  Excellent: 5,
  'Very Good': 4,
  Good: 3,
  Fair: 2,
  Poor: 1,
}

export function typeLabel(type: QuestionRow['question_type'], required: boolean) {
  if (type === 'rating') return 'Rating scale'
  if (type === 'choice') return 'Multiple choice'
  return required ? 'Long text' : 'Long text · Optional'
}

export function fromTypeLabel(label: string): QuestionRow['question_type'] {
  if (label.startsWith('Rating')) return 'rating'
  if (label.startsWith('Multiple')) return 'choice'
  return 'text'
}

export function scoreForCare(value: string | undefined) {
  if (!value) return 0
  return ratingScores[value] ?? 0
}

export function formatResponseDate(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()

  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (sameDay) return `Today, ${time}`
  if (isYesterday) return `Yesterday, ${time}`
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`
}

export function shortWait(value: string) {
  if (value.startsWith('Very short')) return 'Very short'
  if (value.startsWith('Short')) return 'Short'
  if (value.startsWith('Reasonable')) return 'Reasonable'
  if (value.startsWith('Long')) return 'Long'
  if (value.startsWith('Very long')) return 'Very long'
  return value
}

export function shortRecommend(value: string) {
  if (value.includes('definitely') && value.startsWith('Yes')) return 'Definitely'
  if (value.includes('probably') && value.startsWith('Yes')) return 'Probably'
  if (value.includes('Not sure')) return 'Not sure'
  if (value.includes('Probably not')) return 'Probably not'
  if (value.includes('definitely not')) return 'Definitely not'
  return value
}

export function defaultOptionsForType(type: QuestionRow['question_type']): QuestionOption[] {
  if (type === 'rating') {
    return [
      { label: 'Excellent', icon: 'excellent' },
      { label: 'Very Good', icon: 'veryGood' },
      { label: 'Good', icon: 'good' },
      { label: 'Fair', icon: 'fair' },
      { label: 'Poor', icon: 'poor' },
    ]
  }
  if (type === 'choice') {
    return [
      { label: 'Option 1', icon: 'definitely' },
      { label: 'Option 2', icon: 'probably' },
      { label: 'Option 3', icon: 'unsure' },
    ]
  }
  return []
}
