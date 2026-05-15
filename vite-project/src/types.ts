export type Page = 'login' | 'yonetim' | 'katilim' | 'cozum' | 'izleme' | 'sonuclar'
export type ExamStatus = 'DRAFT' | 'WAITING' | 'STARTED' | 'FINISHED'
export type ExamVisibility = 'PRIVATE' | 'PUBLIC' | 'HIDDEN'
export type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'TEXT' | 'IMAGE_BASED'
export type Role = 'ADMIN' | 'SINAVHAZIRLAMA' | 'KATILIMCI'

export type User = {
  id: number
  name: string
  email: string
  role: Role
}

export type Exam = {
  id: number
  title: string
  description?: string | null
  duration: number
  status: ExamStatus
  visibility: ExamVisibility
  joinCode: string
  createdBy: number
  startTime?: string | null
  scheduledStartTime?: string | null
  questionCount?: number
}

export type QuestionOption = {
  id: number
  optionText: string
  correct: boolean
}

export type Question = {
  id: number
  questionText: string
  questionType: QuestionType
  imagePath?: string | null
  orderNo: number
  options: QuestionOption[]
}

export type Participant = {
  id: number
  examId: number
  userId?: number | null
  nickname: string
  email?: string | null
  joinedAt: string
  currentQuestionNo: number
  progressPercent: number
  lastSeenAt: string
  finishedAt?: string | null
}

export type Answer = {
  id: number
  participantId: number
  questionId: number
  selectedOptionId?: number | null
  textAnswer?: string | null
  correct?: boolean | null
  answeredAt: string
}

export type LeaderboardRow = {
  participantId: number
  nickname: string
  score: number
  finishMillis: number
}

export type RealtimeEvent = {
  type?: string
  extendedMinutes?: number
}

export type OptionDraft = {
  optionText: string
  correct: boolean
}
