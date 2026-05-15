import type { ExamVisibility, QuestionType, Role } from './types'

export const questionTypes: QuestionType[] = ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'TEXT']
export const visibilities: ExamVisibility[] = ['PUBLIC', 'PRIVATE', 'HIDDEN']
export const roles: Role[] = ['SINAVHAZIRLAMA', 'KATILIMCI', 'ADMIN']
