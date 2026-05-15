import type { ExamStatus, ExamVisibility, QuestionType } from './types'

export function formatDate(value?: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds)
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export function statusLabel(status: ExamStatus) {
  const labels: Record<ExamStatus, string> = {
    DRAFT: 'Taslak',
    WAITING: 'Bekliyor',
    STARTED: 'Başladı',
    FINISHED: 'Bitti',
  }
  return labels[status]
}

export function questionTypeLabel(type: QuestionType) {
  const labels: Record<QuestionType, string> = {
    MULTIPLE_CHOICE: 'Çoktan seçmeli',
    TRUE_FALSE: 'Doğru / yanlış',
    TEXT: 'Metin cevaplı',
    IMAGE_BASED: 'Görselli soru',
  }
  return labels[type]
}

export function visibilityLabel(visibility: ExamVisibility) {
  const labels: Record<ExamVisibility, string> = {
    PUBLIC: 'Herkes kullanabilsin',
    PRIVATE: 'Sadece oluşturan erişsin',
    HIDDEN: 'Gizli test',
  }
  return labels[visibility]
}
