package com.sorumaraton.exam.service;

import com.sorumaraton.exam.domain.*;
import com.sorumaraton.exam.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ExamService {
    private final ExamRepository examRepository;
    private final QuestionRepository questionRepository;
    private final QuestionOptionRepository questionOptionRepository;
    private final ParticipantRepository participantRepository;
    private final ParticipantAnswerRepository participantAnswerRepository;
    private final ExamSessionRepository examSessionRepository;
    private final ExamEventPublisher eventPublisher;

    @Transactional
    public Exam createExam(String title, String description, Integer duration, Long createdBy) {
        return createExam(title, description, duration, null, ExamVisibility.PRIVATE, createdBy);
    }

    @Transactional
    public Exam createExam(String title, String description, Integer duration, Instant scheduledStartTime,
                           ExamVisibility visibility, Long createdBy) {
        Exam exam = Exam.builder()
                .title(title)
                .description(description)
                .duration(duration)
                .createdBy(createdBy)
                .status(ExamStatus.WAITING)
                .visibility(visibility == null ? ExamVisibility.PRIVATE : visibility)
                .scheduledStartTime(scheduledStartTime)
                .joinCode(UUID.randomUUID().toString().substring(0, 8))
                .build();
        return examRepository.save(exam);
    }

    @Transactional
    public Question addQuestion(Long examId, String questionText, QuestionType questionType, String imagePath,
                                Integer orderNo, List<QuestionOptionInput> optionInputs) {
        Exam exam = examRepository.findById(examId).orElseThrow();
        if (exam.getStatus() == ExamStatus.STARTED || exam.getStatus() == ExamStatus.FINISHED) {
            throw new IllegalStateException("Started or finished exams cannot be edited.");
        }

        Question question = Question.builder()
                .exam(exam)
                .questionText(questionText)
                .questionType(questionType)
                .imagePath(imagePath)
                .orderNo(orderNo == null ? nextQuestionOrder(examId) : orderNo)
                .build();

        if (optionInputs != null) {
            for (QuestionOptionInput input : optionInputs) {
                QuestionOption option = QuestionOption.builder()
                        .question(question)
                        .optionText(input.optionText())
                        .correct(Boolean.TRUE.equals(input.correct()))
                        .build();
                question.getOptions().add(option);
            }
        }

        return questionRepository.save(question);
    }

    @Transactional
    public Participant joinExam(String joinCode, Long userId, String nickname, String email) {
        Exam exam = examRepository.findByJoinCode(joinCode).orElseThrow();
        if (exam.getStatus() == ExamStatus.FINISHED) {
            throw new IllegalStateException("Finished exams cannot be joined.");
        }
        Participant participant = Participant.builder()
                .exam(exam)
                .userId(userId)
                .nickname(nickname)
                .email(email)
                .joinedAt(Instant.now())
                .currentQuestionNo(0)
                .progressPercent(0)
                .lastSeenAt(Instant.now())
                .build();
        Participant saved = participantRepository.save(participant);
        eventPublisher.publish(exam.getId(), "PARTICIPANT_JOINED", Map.of(
                "type", "PARTICIPANT_JOINED",
                "examId", exam.getId(),
                "participantId", saved.getId(),
                "nickname", saved.getNickname(),
                "participantCount", participantRepository.countByExamId(exam.getId())
        ));
        return saved;
    }

    @Transactional
    public Exam startExam(Long examId) {
        Exam exam = examRepository.findById(examId).orElseThrow();
        if (questionRepository.countByExamId(examId) == 0) {
            throw new IllegalStateException("Exam cannot start without questions.");
        }
        exam.setStatus(ExamStatus.STARTED);
        exam.setStartTime(Instant.now());
        Exam saved = examRepository.save(exam);
        examSessionRepository.findByExamId(examId).orElseGet(() -> examSessionRepository.save(ExamSession.builder()
                .exam(saved)
                .startedAt(saved.getStartTime())
                .extendedMinutes(0)
                .build()));
        eventPublisher.publish(examId, "EXAM_STARTED", Map.of(
                "type", "EXAM_STARTED",
                "examId", examId,
                "startedAt", saved.getStartTime().toString(),
                "duration", saved.getDuration()
        ));
        return saved;
    }

    @Transactional
    public Exam extendExam(Long examId, Integer minutes) {
        if (minutes == null || minutes < 1) {
            throw new IllegalArgumentException("Extension minutes must be positive.");
        }
        Exam exam = examRepository.findById(examId).orElseThrow();
        ExamSession session = examSessionRepository.findByExamId(examId).orElseGet(() -> examSessionRepository.save(ExamSession.builder()
                .exam(exam)
                .startedAt(exam.getStartTime())
                .extendedMinutes(0)
                .build()));
        session.setExtendedMinutes((session.getExtendedMinutes() == null ? 0 : session.getExtendedMinutes()) + minutes);
        examSessionRepository.save(session);
        eventPublisher.publish(examId, "EXAM_EXTENDED", Map.of(
                "type", "EXAM_EXTENDED",
                "examId", examId,
                "extendedMinutes", session.getExtendedMinutes()
        ));
        return exam;
    }

    @Transactional
    public Exam finishExam(Long examId) {
        Exam exam = examRepository.findById(examId).orElseThrow();
        exam.setStatus(ExamStatus.FINISHED);
        Exam saved = examRepository.save(exam);
        ExamSession session = examSessionRepository.findByExamId(examId).orElse(null);
        if (session != null) {
            session.setEndedAt(Instant.now());
            examSessionRepository.save(session);
        }
        eventPublisher.publish(examId, "EXAM_FINISHED", Map.of("type", "EXAM_FINISHED", "examId", examId));
        return saved;
    }

    @Transactional
    public Participant updateProgress(Long participantId, Integer currentQuestionNo, Integer progressPercent) {
        Participant participant = participantRepository.findById(participantId).orElseThrow();
        participant.setCurrentQuestionNo(currentQuestionNo);
        participant.setProgressPercent(progressPercent);
        participant.setLastSeenAt(Instant.now());
        Participant saved = participantRepository.save(participant);
        eventPublisher.publish(saved.getExam().getId(), "PARTICIPANT_PROGRESS", Map.of(
                "type", "PARTICIPANT_PROGRESS",
                "examId", saved.getExam().getId(),
                "participantId", saved.getId(),
                "nickname", saved.getNickname(),
                "currentQuestionNo", saved.getCurrentQuestionNo(),
                "progressPercent", saved.getProgressPercent()
        ));
        return saved;
    }

    @Transactional
    public ParticipantAnswer answerQuestion(Long participantId, Long questionId, Long selectedOptionId, String textAnswer) {
        Participant participant = participantRepository.findById(participantId).orElseThrow();
        Question question = questionRepository.findById(questionId).orElseThrow();
        QuestionOption selectedOption = selectedOptionId == null ? null : questionOptionRepository.findById(selectedOptionId).orElseThrow();
        boolean correct = selectedOption != null && Boolean.TRUE.equals(selectedOption.getCorrect());

        ParticipantAnswer answer = participantAnswerRepository.findByParticipantIdAndQuestionId(participantId, questionId)
                .orElseGet(() -> ParticipantAnswer.builder()
                        .participant(participant)
                        .question(question)
                        .build());
        answer.setSelectedOption(selectedOption);
        answer.setTextAnswer(textAnswer);
        answer.setCorrect(question.getQuestionType() == QuestionType.TEXT ? null : correct);
        answer.setAnsweredAt(Instant.now());
        ParticipantAnswer saved = participantAnswerRepository.save(answer);
        updateProgressAfterAnswer(participant, question);
        return saved;
    }

    @Transactional
    public Participant finishParticipant(Long participantId) {
        Participant participant = participantRepository.findById(participantId).orElseThrow();
        participant.setFinishedAt(Instant.now());
        participant.setProgressPercent(100);
        Participant saved = participantRepository.save(participant);
        eventPublisher.publish(saved.getExam().getId(), "PARTICIPANT_FINISHED", Map.of(
                "type", "PARTICIPANT_FINISHED",
                "examId", saved.getExam().getId(),
                "participantId", saved.getId(),
                "nickname", saved.getNickname()
        ));
        return saved;
    }

    @Transactional(readOnly = true)
    public List<Exam> listExams() { return examRepository.findAll(); }

    @Transactional(readOnly = true)
    public long questionCount(Long examId) { return questionRepository.countByExamId(examId); }

    @Transactional(readOnly = true)
    public List<Question> listQuestions(Long examId) {
        Exam exam = examRepository.findById(examId).orElseThrow();
        if (exam.getStatus() != ExamStatus.STARTED && exam.getStatus() != ExamStatus.FINISHED) {
            throw new IllegalStateException("Questions are only visible after the exam starts.");
        }
        return questionRepository.findByExamIdOrderByOrderNoAsc(examId);
    }

    @Transactional(readOnly = true)
    public List<Participant> listParticipants(Long examId) {
        return participantRepository.findByExamIdOrderByJoinedAtAsc(examId);
    }

    @Transactional(readOnly = true)
    public List<LeaderboardRow> leaderboard(Long examId) {
        return participantRepository.findByExamIdOrderByJoinedAtAsc(examId).stream()
                .map(participant -> {
                    int score = (int) participantAnswerRepository.findByParticipantId(participant.getId()).stream()
                            .filter(answer -> Boolean.TRUE.equals(answer.getCorrect()))
                            .count();
                    long finishMillis = participant.getFinishedAt() == null ? Long.MAX_VALUE : participant.getFinishedAt().toEpochMilli();
                    return new LeaderboardRow(participant.getId(), participant.getNickname(), score, finishMillis);
                })
                .sorted(Comparator.comparing(LeaderboardRow::score).reversed()
                        .thenComparing(LeaderboardRow::finishMillis))
                .toList();
    }

    private Integer nextQuestionOrder(Long examId) {
        return questionRepository.findByExamIdOrderByOrderNoAsc(examId).stream()
                .map(Question::getOrderNo)
                .filter(Objects::nonNull)
                .max(Integer::compareTo)
                .orElse(0) + 1;
    }

    private void updateProgressAfterAnswer(Participant participant, Question question) {
        long total = questionRepository.countByExamId(participant.getExam().getId());
        if (total == 0) {
            return;
        }
        participant.setCurrentQuestionNo(question.getOrderNo());
        participant.setProgressPercent((int) Math.round((question.getOrderNo() * 100.0) / total));
        participant.setLastSeenAt(Instant.now());
        participantRepository.save(participant);
        eventPublisher.publish(participant.getExam().getId(), "PARTICIPANT_PROGRESS", Map.of(
                "type", "PARTICIPANT_PROGRESS",
                "examId", participant.getExam().getId(),
                "participantId", participant.getId(),
                "nickname", participant.getNickname(),
                "currentQuestionNo", participant.getCurrentQuestionNo(),
                "progressPercent", participant.getProgressPercent()
        ));
    }

    public record QuestionOptionInput(String optionText, Boolean correct) {}
    public record LeaderboardRow(Long participantId, String nickname, Integer score, Long finishMillis) {}
}
