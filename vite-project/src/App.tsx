import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { authRequest, request } from './api'
import './App.css'
import { questionTypes, roles, visibilities } from './constants'
import { formatDate, formatDuration, questionTypeLabel, statusLabel, visibilityLabel } from './formatters'
import { navigate, routeFromHash } from './navigation'
import { createStompFrame, parseStompMessages } from './stomp'
import type {
  Answer,
  Exam,
  ExamVisibility,
  LeaderboardRow,
  OptionDraft,
  Page,
  Participant,
  Question,
  QuestionType,
  RealtimeEvent,
  Role,
  User,
} from './types'

function App() {
  const [page, setPage] = useState<Page>(routeFromHash)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [users, setUsers] = useState<User[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [selectedExamId, setSelectedExamId] = useState<number | ''>('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const [joinedParticipant, setJoinedParticipant] = useState<Participant | null>(null)
  const [answers, setAnswers] = useState<Record<number, Answer>>({})
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [realtimeStatus, setRealtimeStatus] = useState('Bağlantı bekleniyor')
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [localExtensionMinutes, setLocalExtensionMinutes] = useState(0)
  const [securityEvents, setSecurityEvents] = useState<string[]>([])
  const [editingExamId, setEditingExamId] = useState<number | null>(null)
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null)

  const [examForm, setExamForm] = useState({
    title: '',
    description: '',
    duration: 30,
    scheduledStartTime: '',
    visibility: 'PRIVATE' as ExamVisibility,
    createdBy: 1,
  })
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'SINAVHAZIRLAMA' as Role,
  })
  const [questionForm, setQuestionForm] = useState({
    questionText: '',
    questionType: 'MULTIPLE_CHOICE' as QuestionType,
    imagePath: '',
    orderNo: '',
  })
  const [optionDrafts, setOptionDrafts] = useState<OptionDraft[]>([
    { optionText: 'A', correct: true },
    { optionText: 'B', correct: false },
    { optionText: 'C', correct: false },
    { optionText: 'D', correct: false },
  ])
  const [extendMinutes, setExtendMinutes] = useState(5)
  const [joinForm, setJoinForm] = useState({ joinCode: '', userId: '', nickname: '', email: '' })
  const [textAnswers, setTextAnswers] = useState<Record<number, string>>({})

  const selectedExam = useMemo(
    () => exams.find((exam) => exam.id === selectedExamId) ?? null,
    [exams, selectedExamId],
  )
  const isCreator = !currentUser || !selectedExam || currentUser.id === selectedExam.createdBy || currentUser.role === 'ADMIN'
  const canPrepareExam = currentUser?.role === 'SINAVHAZIRLAMA' || currentUser?.role === 'ADMIN'
  const questionsAreVisible = selectedExam?.status === 'STARTED' || selectedExam?.status === 'FINISHED'
  const selectedQuestionCount = selectedExam?.questionCount ?? questions.length

  function pushSecurityEvent(message: string) {
    const time = new Intl.DateTimeFormat('tr-TR', { timeStyle: 'medium' }).format(new Date())
    setSecurityEvents((current) => [`${time} - ${message}`, ...current].slice(0, 8))
  }

  async function run<T>(action: () => Promise<T>, successMessage?: string) {
    setError('')
    setNotice('')
    setLoading(true)
    try {
      const result = await action()
      if (successMessage) setNotice(successMessage)
      return result
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Beklenmeyen bir hata oluştu.')
      return undefined
    } finally {
      setLoading(false)
    }
  }

  async function loadExams() {
    const data = await run(() => request<Exam[]>(''))
    if (data) {
      setExams(data)
      if (!selectedExamId && data.length > 0) setSelectedExamId(data[0].id)
    }
  }

  async function loadUsers() {
    const data = await run(() => authRequest<User[]>('/users'))
    if (data) setUsers(data)
  }

  async function loadExamDetails(examId: number) {
    const [questionData, participantData, leaderboardData] = await Promise.all([
      run(() => request<Question[]>(`/${examId}/questions`)),
      run(() => request<Participant[]>(`/${examId}/participants`)),
      run(() => request<LeaderboardRow[]>(`/${examId}/leaderboard`)),
    ])

    if (questionData) setQuestions(questionData)
    if (participantData) setParticipants(participantData)
    if (leaderboardData) setLeaderboard(leaderboardData)
  }

  useEffect(() => {
    const onHashChange = () => setPage(routeFromHash())
    window.addEventListener('hashchange', onHashChange)
    if (!window.location.hash) navigate('login')
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    const query = window.location.hash.split('?')[1]
    if (!query) return
    const code = new URLSearchParams(query).get('code')
    if (code) setJoinForm((current) => ({ ...current, joinCode: code }))
  }, [page])

  useEffect(() => {
    if (!joinForm.joinCode || typeof selectedExamId === 'number') return
    const examByCode = exams.find((exam) => exam.joinCode === joinForm.joinCode.trim())
    if (examByCode) setSelectedExamId(examByCode.id)
  }, [exams, joinForm.joinCode, selectedExamId])

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadExams(), 0)
    void loadUsers()
    return () => window.clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (typeof selectedExamId !== 'number') return
    const timeout = window.setTimeout(() => void loadExamDetails(selectedExamId), 0)
    return () => window.clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExamId, selectedExam?.status])

  useEffect(() => {
    if (typeof selectedExamId !== 'number') return
    const interval = window.setInterval(() => {
      void loadExams()
      void loadExamDetails(selectedExamId)
    }, 10000)
    return () => window.clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExamId, selectedExam?.status])

  useEffect(() => {
    if (!selectedExam) {
      setRemainingSeconds(0)
      return
    }

    const calculate = () => {
      if (selectedExam.status !== 'STARTED' || !selectedExam.startTime) {
        setRemainingSeconds(selectedExam.duration * 60)
        return
      }
      const startedAt = new Date(selectedExam.startTime).getTime()
      const totalSeconds = (selectedExam.duration + localExtensionMinutes) * 60
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000)
      setRemainingSeconds(Math.max(0, totalSeconds - elapsedSeconds))
    }

    calculate()
    const interval = window.setInterval(calculate, 1000)
    return () => window.clearInterval(interval)
  }, [selectedExam, localExtensionMinutes])

  useEffect(() => {
    if (typeof selectedExamId !== 'number') return

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const socket = new WebSocket(`${protocol}://${window.location.host}/ws`)
    let connected = false

    socket.addEventListener('open', () => {
      setRealtimeStatus('WebSocket bağlanıyor')
      socket.send(createStompFrame('CONNECT', { 'accept-version': '1.2', 'heart-beat': '10000,10000' }))
    })

    socket.addEventListener('message', (event) => {
      for (const frame of parseStompMessages(String(event.data))) {
        if (frame.command === 'CONNECTED' && !connected) {
          connected = true
          setRealtimeStatus('WebSocket aktif')
          socket.send(
            createStompFrame('SUBSCRIBE', {
              id: `exam-${selectedExamId}`,
              destination: `/topic/exams/${selectedExamId}/events`,
            }),
          )
        }

        if (frame.command === 'MESSAGE' && frame.body) {
          const payload = JSON.parse(frame.body) as RealtimeEvent
          if (payload.type === 'EXAM_STARTED') setNotice('Sınav başladı. Soru çözüm ekranı açıldı.')
          if (payload.type === 'EXAM_EXTENDED') {
            setLocalExtensionMinutes(() => payload.extendedMinutes ?? 0)
            setNotice('Sınav süresi güncellendi.')
          }
          if (payload.type === 'EXAM_FINISHED') setNotice('Sınav bitirildi.')
          void loadExams()
          void loadExamDetails(selectedExamId)
        }
      }
    })

    socket.addEventListener('close', () => setRealtimeStatus('WebSocket kapalı, 10 sn yenileme devrede'))
    socket.addEventListener('error', () => setRealtimeStatus('WebSocket hatası, 10 sn yenileme devrede'))

    return () => socket.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExamId])

  useEffect(() => {
    if (page !== 'cozum' || selectedExam?.status !== 'STARTED') return

    const block = (event: Event) => {
      event.preventDefault()
      pushSecurityEvent(`${event.type} engellendi`)
    }
    const visibility = () => {
      if (document.hidden) pushSecurityEvent('Sekme değişimi algılandı')
    }
    const blur = () => pushSecurityEvent('Pencere odağı kayboldu')
    const focus = () => pushSecurityEvent('Pencere odağı geri geldi')

    document.addEventListener('copy', block)
    document.addEventListener('paste', block)
    document.addEventListener('contextmenu', block)
    document.addEventListener('selectstart', block)
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('blur', blur)
    window.addEventListener('focus', focus)

    return () => {
      document.removeEventListener('copy', block)
      document.removeEventListener('paste', block)
      document.removeEventListener('contextmenu', block)
      document.removeEventListener('selectstart', block)
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('blur', blur)
      window.removeEventListener('focus', focus)
    }
  }, [page, selectedExam?.status])

  async function createExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const created = await run(
      () =>
        request<Exam>('', {
          method: 'POST',
          body: JSON.stringify({
            title: examForm.title,
            description: examForm.description || null,
            duration: examForm.duration,
            scheduledStartTime: examForm.scheduledStartTime
              ? new Date(examForm.scheduledStartTime).toISOString()
              : null,
            visibility: examForm.visibility,
            createdBy: currentUser?.id ?? examForm.createdBy,
          }),
        }),
      'Sınav oluşturuldu.',
    )
    if (created) {
      setExamForm({ ...examForm, title: '', description: '', scheduledStartTime: '' })
      await loadExams()
      setSelectedExamId(created.id)
    }
  }

  async function addQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedExam) return

    const options =
      questionForm.questionType === 'TEXT'
        ? []
        : optionDrafts
            .filter((option) => option.optionText.trim())
            .map((option) => ({ optionText: option.optionText.trim(), correct: option.correct }))

    const added = await run(
      () =>
        request<Question>(`/${selectedExam.id}/questions`, {
          method: 'POST',
          body: JSON.stringify({
            questionText: questionForm.questionText,
            questionType: questionForm.questionType,
            imagePath: questionForm.imagePath || null,
            orderNo: questionForm.orderNo ? Number(questionForm.orderNo) : null,
            options,
          }),
        }),
      'Soru eklendi.',
    )

    if (added) {
      setQuestionForm({ questionText: '', questionType: 'MULTIPLE_CHOICE', imagePath: '', orderNo: '' })
      setOptionDrafts([
        { optionText: 'A', correct: true },
        { optionText: 'B', correct: false },
        { optionText: 'C', correct: false },
        { optionText: 'D', correct: false },
      ])
      setQuestions((current) => [...current, added])
    }
  }

  async function upsertExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload = {
      title: examForm.title,
      description: examForm.description || null,
      duration: examForm.duration,
      scheduledStartTime: examForm.scheduledStartTime
        ? new Date(examForm.scheduledStartTime).toISOString()
        : null,
      visibility: examForm.visibility,
      createdBy: currentUser?.id ?? examForm.createdBy,
    }
    const saved = await run(
      () =>
        request<Exam>(editingExamId ? `/${editingExamId}` : '', {
          method: editingExamId ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        }),
      editingExamId ? 'Sınav güncellendi.' : 'Sınav oluşturuldu.',
    )
    if (saved) {
      setExamForm({ ...examForm, title: '', description: '', scheduledStartTime: '' })
      setEditingExamId(null)
      await loadExams()
      setSelectedExamId(saved.id)
    }
  }

  async function upsertQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedExam) return
    const options =
      questionForm.questionType === 'TEXT'
        ? []
        : optionDrafts
            .filter((option) => option.optionText.trim())
            .map((option) => ({ optionText: option.optionText.trim(), correct: option.correct }))
    const saved = await run(
      () =>
        request<Question>(editingQuestionId ? `/questions/${editingQuestionId}` : `/${selectedExam.id}/questions`, {
          method: editingQuestionId ? 'PUT' : 'POST',
          body: JSON.stringify({
            questionText: questionForm.questionText,
            questionType: questionForm.questionType,
            imagePath: questionForm.imagePath || null,
            orderNo: questionForm.orderNo ? Number(questionForm.orderNo) : null,
            options,
          }),
        }),
      editingQuestionId ? 'Soru güncellendi.' : 'Soru eklendi.',
    )
    if (saved) {
      setQuestionForm({ questionText: '', questionType: 'MULTIPLE_CHOICE', imagePath: '', orderNo: '' })
      setOptionDrafts([
        { optionText: 'A', correct: true },
        { optionText: 'B', correct: false },
        { optionText: 'C', correct: false },
        { optionText: 'D', correct: false },
      ])
      setEditingQuestionId(null)
      await loadExamDetails(selectedExam.id)
      await loadExams()
    }
  }

  function editExam(exam: Exam) {
    setEditingExamId(exam.id)
    setSelectedExamId(exam.id)
    setExamForm({
      title: exam.title,
      description: exam.description ?? '',
      duration: exam.duration,
      scheduledStartTime: exam.scheduledStartTime ? exam.scheduledStartTime.slice(0, 16) : '',
      visibility: exam.visibility,
      createdBy: exam.createdBy,
    })
  }

  async function deleteExam(examId: number) {
    await run(() => request<void>(`/${examId}`, { method: 'DELETE' }), 'Sınav silindi.')
    if (selectedExamId === examId) {
      setSelectedExamId('')
      setQuestions([])
    }
    await loadExams()
  }

  function editQuestion(question: Question) {
    setEditingQuestionId(question.id)
    setQuestionForm({
      questionText: question.questionText,
      questionType: question.questionType,
      imagePath: question.imagePath ?? '',
      orderNo: question.orderNo?.toString() ?? '',
    })
    setOptionDrafts(
      question.options.length > 0
        ? question.options.map((option) => ({ optionText: option.optionText, correct: option.correct }))
        : [{ optionText: '', correct: false }],
    )
  }

  async function deleteQuestion(questionId: number) {
    if (!selectedExam) return
    await run(() => request<void>(`/questions/${questionId}`, { method: 'DELETE' }), 'Soru silindi.')
    await loadExamDetails(selectedExam.id)
    await loadExams()
  }

  async function updateUserRole(userId: number, role: Role) {
    const user = await run(
      () => authRequest<User>(`/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
      'Rol güncellendi.',
    )
    if (user) {
      setUsers((current) => current.map((item) => (item.id === user.id ? user : item)))
      if (currentUser?.id === user.id) setCurrentUser(user)
    }
  }

  function logout() {
    setCurrentUser(null)
    setJoinedParticipant(null)
    setAnswers({})
    setSecurityEvents([])
    navigate('login')
  }

  async function updateExamStatus(action: 'start' | 'finish') {
    if (!selectedExam) return
    await run(
      () => request<Exam>(`/${selectedExam.id}/${action}`, { method: 'POST' }),
      action === 'start' ? 'Sınav başlatıldı.' : 'Sınav bitirildi.',
    )
    await loadExams()
    if (action === 'start') navigate('cozum')
    if (action === 'finish') navigate('sonuclar')
  }

  async function extendExam() {
    if (!selectedExam) return
    await run(
      () =>
        request<Exam>(`/${selectedExam.id}/extend`, {
          method: 'POST',
          body: JSON.stringify({ minutes: extendMinutes }),
        }),
      'Sınav süresi uzatıldı.',
    )
    setLocalExtensionMinutes((current) => current + extendMinutes)
  }

  async function joinExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const participant = await run(
      () =>
        request<Participant>(`/join/${joinForm.joinCode.trim()}`, {
          method: 'POST',
          body: JSON.stringify({
            userId: joinForm.userId ? Number(joinForm.userId) : currentUser?.id ?? null,
            nickname: joinForm.nickname || currentUser?.name || '',
            email: joinForm.email || currentUser?.email || null,
          }),
        }),
      'Sınava katıldınız.',
    )

    if (participant) {
      setJoinedParticipant(participant)
      setSelectedExamId(participant.examId)
      await loadExams()
      navigate('cozum')
    }
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const user = await run(
      () =>
        authRequest<User>(authMode === 'login' ? '/login' : '/register', {
          method: 'POST',
          body: JSON.stringify(authMode === 'login' ? { email: authForm.email, password: authForm.password } : authForm),
        }),
      authMode === 'login' ? 'Giriş yapıldı.' : 'Kullanıcı oluşturuldu.',
    )

    if (user) {
      setCurrentUser(user)
      setExamForm((current) => ({ ...current, createdBy: user.id }))
      await loadUsers()
      navigate(user.role === 'KATILIMCI' ? 'katilim' : 'yonetim')
    }
  }

  async function sendProgress(currentQuestionNo: number, progressPercent: number) {
    if (!joinedParticipant) return
    const updated = await run(
      () =>
        request<Participant>(`/participants/${joinedParticipant.id}/progress`, {
          method: 'POST',
          body: JSON.stringify({ currentQuestionNo, progressPercent }),
        }),
      'İlerleme gönderildi.',
    )
    if (updated) setJoinedParticipant(updated)
  }

  async function sendAnswer(question: Question, selectedOptionId?: number) {
    if (!joinedParticipant) return
    const saved = await run(
      () =>
        request<Answer>(`/participants/${joinedParticipant.id}/answers`, {
          method: 'POST',
          body: JSON.stringify({
            questionId: question.id,
            selectedOptionId: selectedOptionId ?? null,
            textAnswer: question.questionType === 'TEXT' ? textAnswers[question.id] || '' : null,
          }),
        }),
      'Cevap kaydedildi.',
    )
    if (saved) {
      setAnswers((current) => ({ ...current, [question.id]: saved }))
      const index = questions.findIndex((item) => item.id === question.id) + 1
      const progress = Math.round((index / Math.max(questions.length, 1)) * 100)
      await sendProgress(index, progress)
      if (joinedParticipant.examId === selectedExamId) await loadExamDetails(joinedParticipant.examId)
    }
  }

  async function finishParticipant() {
    if (!joinedParticipant) return
    const updated = await run(
      () => request<Participant>(`/participants/${joinedParticipant.id}/finish`, { method: 'POST' }),
      'Sınavınız tamamlandı.',
    )
    if (updated) {
      setJoinedParticipant(updated)
      navigate('sonuclar')
    }
  }

  function updateOption(index: number, patch: Partial<OptionDraft>) {
    setOptionDrafts((current) => {
      if (patch.correct === true && questionForm.questionType === 'MULTIPLE_CHOICE') {
        // For multiple choice, only one option can be correct
        return current.map((option, optionIndex) =>
          optionIndex === index ? { ...option, correct: true } : { ...option, correct: false }
        )
      }
      return current.map((option, optionIndex) => (optionIndex === index ? { ...option, ...patch } : option))
    })
  }

  function makeTrueFalseOptions() {
    setQuestionForm((current) => ({ ...current, questionType: 'TRUE_FALSE' }))
    setOptionDrafts([
      { optionText: 'Doğru', correct: true },
      { optionText: 'Yanlış', correct: false },
    ])
  }

  void createExam
  void addQuestion

  const pageTitle: Record<Page, string> = {
    login: 'Giriş',
    yonetim: 'Sınav Yönetimi',
    katilim: 'Sınava Katılım',
    cozum: 'Soru Çözüm',
    izleme: 'Canlı İzleme',
    sonuclar: 'Sonuçlar',
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Sınav Maratonu</p>
          <h1>{pageTitle[page]}</h1>
        </div>
        <div className="topbar-actions">
          {currentUser && (
            <div className="user-chip">
              <strong>{currentUser.name}</strong>
              <span>{currentUser.role}</span>
            </div>
          )}
          <div className="status-chip">
            <strong>{realtimeStatus}</strong>
            <span>Yenileme: 10 sn</span>
          </div>
          {currentUser && (
            <button className="ghost-button" type="button" onClick={logout}>
              Çıkış
            </button>
          )}
          <button className="ghost-button" type="button" onClick={loadExams} disabled={loading}>
            Yenile
          </button>
        </div>
      </header>

      {page !== 'login' && (
        <nav className="page-nav" aria-label="Sayfalar">
          <button className={page === 'yonetim' ? 'active' : ''} type="button" onClick={() => navigate('yonetim')}>
            Yönetim
          </button>
          <button className={page === 'katilim' ? 'active' : ''} type="button" onClick={() => navigate('katilim')}>
            Katılım
          </button>
          <button className={page === 'cozum' ? 'active' : ''} type="button" onClick={() => navigate('cozum')}>
            Soru Çözüm
          </button>
          <button className={page === 'izleme' ? 'active' : ''} type="button" onClick={() => navigate('izleme')}>
            Canlı İzleme
          </button>
          <button className={page === 'sonuclar' ? 'active' : ''} type="button" onClick={() => navigate('sonuclar')}>
            Sonuçlar
          </button>
        </nav>
      )}

      {(notice || error) && (
        <section className={error ? 'alert error' : 'alert'}>
          <span>{error || notice}</span>
        </section>
      )}

      {page !== 'login' && (
        <section className="selector-row">
          <label>
            Aktif sınav
            <select
              value={selectedExamId}
              onChange={(event) => setSelectedExamId(event.target.value ? Number(event.target.value) : '')}
            >
              <option value="">Sınav seçin</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  #{exam.id} {exam.title} - {statusLabel(exam.status)}
                </option>
              ))}
            </select>
          </label>
          {selectedExam && (
            <div className="exam-meta">
              <strong>{selectedExam.joinCode}</strong>
              <span>{selectedQuestionCount} soru</span>
              <span>{participants.length} katılımcı</span>
              <span>{formatDuration(remainingSeconds)}</span>
              <span>{statusLabel(selectedExam.status)}</span>
            </div>
          )}
        </section>
      )}

      {page === 'login' && (
        <section className="login-layout">
          <form className="panel login-card" onSubmit={submitAuth}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">{authMode === 'login' ? 'Personel / Katılımcı' : 'Yeni kullanıcı'}</p>
                <h2>{authMode === 'login' ? 'Giriş yap' : 'Kayıt ol'}</h2>
              </div>
              <button
                className="ghost-button"
                type="button"
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              >
                {authMode === 'login' ? 'Kayıt' : 'Giriş'}
              </button>
            </div>
            {authMode === 'register' && (
              <label>
                Ad soyad
                <input
                  required
                  value={authForm.name}
                  onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                />
              </label>
            )}
            <label>
              E-posta
              <input
                required
                type="email"
                value={authForm.email}
                onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
              />
            </label>
            <label>
              Şifre
              <input
                required
                type="password"
                value={authForm.password}
                onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
              />
            </label>
            {authMode === 'register' && (
              <label>
                Rol
                <select value={authForm.role} onChange={(event) => setAuthForm({ ...authForm, role: event.target.value as Role })}>
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button type="submit" disabled={loading}>
              {authMode === 'login' ? 'Giriş yap' : 'Kayıt ol'}
            </button>
          </form>
          <section className="panel login-card">
            <h2>Sayfa akışı</h2>
            <div className="flow-list">
              <span>1. Login ayrı sayfa</span>
              <span>2. Sınav hazırlama ve yönetim ayrı sayfa</span>
              <span>3. Katılım başlangıç ekranı ayrı sayfa</span>
              <span>4. Soru çözüm ekranı ayrı sayfa</span>
              <span>5. Canlı izleme ve sonuçlar ayrı sayfa</span>
            </div>
          </section>
        </section>
      )}

      {page === 'yonetim' && (
        <section className="layout">
          <form className="panel" onSubmit={upsertExam}>
            <div className="section-heading">
              <h2>Sınav Oluştur</h2>
              {!canPrepareExam && <small>Sınav oluşturmak için SINAVHAZIRLAMA rolü gerekir.</small>}
            </div>
            <label>
              Başlık
              <input required value={examForm.title} onChange={(event) => setExamForm({ ...examForm, title: event.target.value })} />
            </label>
            <label>
              Açıklama
              <textarea value={examForm.description} onChange={(event) => setExamForm({ ...examForm, description: event.target.value })} />
            </label>
            <div className="field-grid">
              <label>
                Süre
                <input
                  min={1}
                  type="number"
                  value={examForm.duration}
                  onChange={(event) => setExamForm({ ...examForm, duration: Number(event.target.value) })}
                />
              </label>
              <label>
                Oluşturan
                <input
                  min={1}
                  type="number"
                  disabled={!!currentUser}
                  value={examForm.createdBy}
                  onChange={(event) => setExamForm({ ...examForm, createdBy: Number(event.target.value) })}
                />
              </label>
            </div>
            <label>
              Planlanan başlangıç
              <input
                type="datetime-local"
                value={examForm.scheduledStartTime}
                onChange={(event) => setExamForm({ ...examForm, scheduledStartTime: event.target.value })}
              />
            </label>
            <label>
              Erişim durumu
              <select value={examForm.visibility} onChange={(event) => setExamForm({ ...examForm, visibility: event.target.value as ExamVisibility })}>
                {visibilities.map((visibility) => (
                  <option key={visibility} value={visibility}>
                    {visibilityLabel(visibility)}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={!canPrepareExam || loading}>
              Oluştur
            </button>
          </form>

          <form className="panel" onSubmit={upsertQuestion}>
            <h2>Soru Ekle</h2>
            <label>
              Soru metni
              <textarea
                required
                value={questionForm.questionText}
                onChange={(event) => setQuestionForm({ ...questionForm, questionText: event.target.value })}
              />
            </label>
            <div className="field-grid">
              <label>
                Tür
                <select
                  value={questionForm.questionType}
                  onChange={(event) => setQuestionForm({ ...questionForm, questionType: event.target.value as QuestionType })}
                >
                  {questionTypes.map((type) => (
                    <option key={type} value={type}>
                      {questionTypeLabel(type)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Sıra
                <input min={1} type="number" value={questionForm.orderNo} onChange={(event) => setQuestionForm({ ...questionForm, orderNo: event.target.value })} />
              </label>
            </div>
            <label>
              Görsel yolu
              <input value={questionForm.imagePath} onChange={(event) => setQuestionForm({ ...questionForm, imagePath: event.target.value })} />
            </label>

            {questionForm.questionType !== 'TEXT' && (
              <div className="options-editor">
                <div className="option-toolbar">
                  <button className="ghost-button" type="button" onClick={() => setOptionDrafts((current) => [...current, { optionText: '', correct: false }])}>
                    Seçenek ekle
                  </button>
                  <button className="ghost-button" type="button" onClick={makeTrueFalseOptions}>
                    Doğru / Yanlış yap
                  </button>
                </div>
                {optionDrafts.map((option, index) => (
                  <div className="option-row" key={index}>
                    <input placeholder={`Seçenek ${index + 1}`} value={option.optionText} onChange={(event) => updateOption(index, { optionText: event.target.value })} />
                    <label className="check-label">
                      <input type="radio" name={`correct-answer-${selectedExamId}`} checked={option.correct} onChange={(event) => updateOption(index, { correct: event.target.checked })} />
                      Doğru Cevap
                    </label>
                  </div>
                ))}
              </div>
            )}

            <button type="submit" disabled={!selectedExam || !canPrepareExam || loading}>
              Soruyu Kaydet
            </button>
          </form>

          <section className="panel">
            <h2>Test Soruları</h2>
            <div className="list">
              {questions.length === 0 && <small>Seçili testte soru yok.</small>}
              {questions.map((question) => (
                <div className="list-item editable-item" key={question.id}>
                  <span>{question.orderNo}</span>
                  <strong>{question.questionText}</strong>
                  <small>{questionTypeLabel(question.questionType)}</small>
                  <div className="item-actions">
                    <button className="ghost-button" type="button" onClick={() => editQuestion(question)} disabled={!canPrepareExam || !selectedExam}>
                      Düzenle
                    </button>
                    <button className="ghost-button danger-button" type="button" onClick={() => void deleteQuestion(question.id)} disabled={!canPrepareExam || !selectedExam}>
                      Sil
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {currentUser?.role === 'ADMIN' && (
            <section className="panel">
              <h2>Kullanıcı Rolleri</h2>
              <div className="list">
                {users.map((user) => (
                  <div className="list-item editable-item" key={user.id}>
                    <span>#{user.id}</span>
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                    <select value={user.role} onChange={(event) => void updateUserRole(user.id, event.target.value as Role)}>
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="panel">
            <h2>Sınav İşlemleri</h2>
            <div className="action-row">
              <button type="button" onClick={() => void updateExamStatus('start')} disabled={!selectedExam || !isCreator || loading}>
                Başlat
              </button>
              <button type="button" onClick={() => void updateExamStatus('finish')} disabled={!selectedExam || !isCreator || loading}>
                Bitir
              </button>
            </div>
            <div className="action-row">
              <input min={1} type="number" value={extendMinutes} onChange={(event) => setExtendMinutes(Number(event.target.value))} aria-label="Uzatma dakikası" />
              <button type="button" onClick={extendExam} disabled={!selectedExam || !isCreator || loading}>
                Süre Uzat
              </button>
            </div>
            {selectedExam && (
              <div className="waiting-box">
                <strong>Katılım linki</strong>
                <span>{`${window.location.origin}${window.location.pathname}#/katilim?code=${selectedExam.joinCode}`}</span>
              </div>
            )}
            <div className="list">
              {exams.map((exam) => (
                <div className="list-item editable-item" key={exam.id}>
                  <span>#{exam.id}</span>
                  <strong>{exam.title}</strong>
                  <small>{exam.joinCode}</small>
                  <div className="item-actions">
                    <button className="ghost-button" type="button" onClick={() => setSelectedExamId(exam.id)}>
                      Seç
                    </button>
                    <button className="ghost-button" type="button" onClick={() => editExam(exam)} disabled={!canPrepareExam || exam.status === 'STARTED' || exam.status === 'FINISHED'}>
                      Düzenle
                    </button>
                    <button className="ghost-button danger-button" type="button" onClick={() => void deleteExam(exam.id)} disabled={!canPrepareExam || exam.status === 'STARTED' || exam.status === 'FINISHED'}>
                      Sil
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>
      )}

      {page === 'katilim' && (
        <section className="layout two-column">
          <form className="panel" onSubmit={joinExam}>
            <h2>Sınava Katıl</h2>
            <label>
              Katılım kodu
              <input required value={joinForm.joinCode} onChange={(event) => setJoinForm({ ...joinForm, joinCode: event.target.value })} />
            </label>
            <label>
              Takma ad / nickname
              <input required value={joinForm.nickname} onChange={(event) => setJoinForm({ ...joinForm, nickname: event.target.value })} />
            </label>
            <div className="field-grid">
              <label>
                Kullanıcı ID
                <input type="number" value={joinForm.userId} onChange={(event) => setJoinForm({ ...joinForm, userId: event.target.value })} />
              </label>
              <label>
                E-posta
                <input type="email" value={joinForm.email} onChange={(event) => setJoinForm({ ...joinForm, email: event.target.value })} />
              </label>
            </div>
            <button type="submit" disabled={loading}>
              Katıl ve bekleme ekranına geç
            </button>
          </form>

          <section className="panel wide-panel">
            <div className="exam-stage">
              <div>
                <h2>Başlangıç Ekranı</h2>
                <p className="muted">Sınavı hazırlayan kişi başlatmadan sorular görünmez.</p>
              </div>
              <strong>{selectedExam ? statusLabel(selectedExam.status) : '-'}</strong>
            </div>
            <div className="waiting-grid">
              <span>Soru adedi: {selectedQuestionCount}</span>
              <span>Katılımcı sayısı: {participants.length}</span>
              <span>Hazırlayan: {selectedExam?.createdBy ?? '-'}</span>
              <span>Süre: {selectedExam?.duration ?? 0} dk</span>
            </div>
            <h2>Katılımcı Listesi</h2>
            <div className="compact-list">
              {participants.length === 0 ? <small>Henüz katılımcı yok.</small> : participants.map((participant) => <span key={participant.id}>{participant.nickname}</span>)}
            </div>
          </section>
        </section>
      )}

      {page === 'cozum' && (
        <section className="layout two-column solve-layout">
          <aside className="panel">
            <h2>Canlı Durum</h2>
            {joinedParticipant && (
              <div className="participant-box">
                <strong>{joinedParticipant.nickname}</strong>
                <span>Katılımcı #{joinedParticipant.id}</span>
                <span>{joinedParticipant.progressPercent}% tamamlandı</span>
              </div>
            )}
            <div className="progress-list">
              {participants.map((participant) => (
                <div className="progress-row" key={participant.id}>
                  <strong>{participant.nickname}</strong>
                  <span>Soru {participant.currentQuestionNo}</span>
                  <meter min={0} max={100} value={participant.progressPercent} />
                  <small>{participant.progressPercent}%</small>
                </div>
              ))}
            </div>
            <div className="security-list">
              <strong>Güvenlik olayları</strong>
              {securityEvents.length === 0 ? <small>Henüz olay yok.</small> : securityEvents.map((event, index) => <small key={index}>{event}</small>)}
            </div>
          </aside>

          <section className="panel wide-panel">
            <div className="exam-stage">
              <div>
                <h2>{selectedExam?.status === 'STARTED' ? 'Sınav başladı' : 'Bekleme ekranı'}</h2>
                <p className="muted">
                  {questionsAreVisible
                    ? 'Soruları çözebilirsiniz. Her cevap ilerlemeyi canlı izleme ekranına gönderir.'
                    : 'Start / Başlat verilmeden sorular burada gösterilmez.'}
                </p>
              </div>
              <strong>{formatDuration(remainingSeconds)}</strong>
            </div>

            {!questionsAreVisible && (
              <div className="waiting-grid">
                <span>Test: {selectedExam?.title ?? '-'}</span>
                <span>Soru sayısı: {selectedQuestionCount}</span>
                <span>Katılımcı: {participants.length}</span>
                <span>Hazırlayan: {selectedExam?.createdBy ?? '-'}</span>
              </div>
            )}

            {questionsAreVisible && (
              <div className="question-list">
                {questions.map((question, index) => (
                  <article className="question-card" key={question.id}>
                    <div className="question-head">
                      <span>{index + 1}</span>
                      <strong>{question.questionText}</strong>
                    </div>
                    {question.imagePath && <img src={question.imagePath} alt="" />}
                    {question.questionType === 'TEXT' ? (
                      <div className="answer-row">
                        <input
                          placeholder="Cevabınız"
                          value={textAnswers[question.id] ?? ''}
                          onChange={(event) => setTextAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                        />
                        <button type="button" onClick={() => void sendAnswer(question)} disabled={!joinedParticipant}>
                          Gönder
                        </button>
                      </div>
                    ) : (
                      <div className="choice-list">
                        {question.options.map((option) => (
                          <button type="button" key={option.id} onClick={() => void sendAnswer(question, option.id)} disabled={!joinedParticipant}>
                            {option.optionText}
                          </button>
                        ))}
                      </div>
                    )}
                    {answers[question.id] && <small>Cevap kaydı #{answers[question.id].id}</small>}
                  </article>
                ))}
              </div>
            )}
            {joinedParticipant && questionsAreVisible && (
              <div className="action-row bottom-actions">
                <button type="button" onClick={finishParticipant}>
                  Sınavı Bitir
                </button>
                <button type="button" onClick={() => document.documentElement.requestFullscreen().catch(() => pushSecurityEvent('Fullscreen açılamadı'))}>
                  Fullscreen
                </button>
              </div>
            )}
          </section>
        </section>
      )}

      {page === 'izleme' && (
        <section className="layout two-column">
          <section className="panel wide-panel">
            <h2>Canlı İzleme</h2>
            <div className="table">
              <div className="table-row table-head">
                <span>Ad</span>
                <span>Soru</span>
                <span>İlerleme</span>
                <span>Son görülme</span>
                <span>Durum</span>
              </div>
              {participants.map((participant) => (
                <div className="table-row" key={participant.id}>
                  <span>{participant.nickname}</span>
                  <span>{participant.currentQuestionNo}</span>
                  <span>{participant.progressPercent}%</span>
                  <span>{formatDate(participant.lastSeenAt)}</span>
                  <span>{participant.finishedAt ? 'Bitirdi' : 'Devam'}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>Özet</h2>
            <div className="metric-grid">
              <span>{participants.length}<small>Katılımcı</small></span>
              <span>{selectedQuestionCount}<small>Soru</small></span>
              <span>{leaderboard[0]?.score ?? 0}<small>En yüksek doğru</small></span>
              <span>{formatDuration(remainingSeconds)}<small>Kalan süre</small></span>
            </div>
          </section>
        </section>
      )}

      {page === 'sonuclar' && (
        <section className="layout two-column">
          <section className="panel wide-panel">
            <h2>Sonuç Sıralaması</h2>
            <div className="rank-list">
              {leaderboard.map((row, index) => (
                <div className="rank-row" key={row.participantId}>
                  <span>{index + 1}</span>
                  <strong>{row.nickname}</strong>
                  <small>{row.score} doğru</small>
                  <small>{Math.round(row.finishMillis / 1000)} sn</small>
                </div>
              ))}
              {leaderboard.length === 0 && <small>Sonuç yok.</small>}
            </div>
          </section>
          <section className="panel">
            <h2>Sıralama Kuralı</h2>
            <div className="waiting-box">
              <span>En yüksek puan üstte görünür. Puanlar eşitse sınavı daha erken bitiren aday daha başarılı kabul edilir.</span>
            </div>
          </section>
        </section>
      )}
    </main>
  )
}

export default App
