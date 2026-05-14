package com.sorumaraton.exam.api;

import com.sorumaraton.exam.domain.*;
import com.sorumaraton.exam.service.ExamService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.*;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/exams")
@RequiredArgsConstructor
public class ExamController {
    private final ExamService examService;

    @PostMapping
    public ExamResponse create(@Valid @RequestBody CreateExamRequest request) {
        Exam exam = examService.createExam(
                request.title(),
                request.description(),
                request.duration(),
                request.scheduledStartTime(),
                request.visibility(),
                request.createdBy()
        );
        return ExamResponse.from(exam, examService.questionCount(exam.getId()));
    }

    @PostMapping("/{examId}/questions")
    public QuestionResponse addQuestion(@PathVariable Long examId, @Valid @RequestBody AddQuestionRequest request) {
        Question question = examService.addQuestion(
                examId,
                request.questionText(),
                request.questionType(),
                request.imagePath(),
                request.orderNo(),
                request.options() == null ? List.of() : request.options().stream()
                        .map(option -> new ExamService.QuestionOptionInput(option.optionText(), option.correct()))
                        .toList()
        );
        return QuestionResponse.from(question);
    }

    @PostMapping("/{examId}/start")
    public ExamResponse start(@PathVariable Long examId) {
        Exam exam = examService.startExam(examId);
        return ExamResponse.from(exam, examService.questionCount(exam.getId()));
    }

    @PostMapping("/{examId}/extend")
    public ExamResponse extend(@PathVariable Long examId, @Valid @RequestBody ExtendExamRequest request) {
        Exam exam = examService.extendExam(examId, request.minutes());
        return ExamResponse.from(exam, examService.questionCount(exam.getId()));
    }

    @PostMapping("/{examId}/finish")
    public ExamResponse finish(@PathVariable Long examId) {
        Exam exam = examService.finishExam(examId);
        return ExamResponse.from(exam, examService.questionCount(exam.getId()));
    }

    @GetMapping
    public List<ExamResponse> list() {
        return examService.listExams().stream()
                .map(exam -> ExamResponse.from(exam, examService.questionCount(exam.getId())))
                .toList();
    }

    @GetMapping("/{examId}/questions")
    public List<QuestionResponse> questions(@PathVariable Long examId) {
        return examService.listQuestions(examId).stream().map(QuestionResponse::from).toList();
    }

    @GetMapping("/{examId}/participants")
    public List<ParticipantResponse> participants(@PathVariable Long examId) {
        return examService.listParticipants(examId).stream().map(ParticipantResponse::from).toList();
    }

    @GetMapping("/{examId}/leaderboard")
    public List<ExamService.LeaderboardRow> leaderboard(@PathVariable Long examId) {
        return examService.leaderboard(examId);
    }

    @PostMapping("/join/{joinCode}")
    public ParticipantResponse join(@PathVariable String joinCode, @Valid @RequestBody JoinExamRequest request) {
        return ParticipantResponse.from(examService.joinExam(joinCode, request.userId(), request.nickname(), request.email()));
    }

    @PostMapping("/participants/{participantId}/progress")
    public ParticipantResponse progress(@PathVariable Long participantId, @Valid @RequestBody ProgressRequest request) {
        return ParticipantResponse.from(examService.updateProgress(participantId, request.currentQuestionNo(), request.progressPercent()));
    }

    @PostMapping("/participants/{participantId}/answers")
    public AnswerResponse answer(@PathVariable Long participantId, @Valid @RequestBody AnswerRequest request) {
        return AnswerResponse.from(examService.answerQuestion(
                participantId,
                request.questionId(),
                request.selectedOptionId(),
                request.textAnswer()
        ));
    }

    @PostMapping("/participants/{participantId}/finish")
    public ParticipantResponse finishParticipant(@PathVariable Long participantId) {
        return ParticipantResponse.from(examService.finishParticipant(participantId));
        //return ParticipantResponse.from(examService.finishParticipant(participantId));
    }

    public record CreateExamRequest(
            @NotBlank String title,
            String description,
            @NotNull @Min(1) Integer duration,
            Instant scheduledStartTime,
            ExamVisibility visibility,
            @NotNull Long createdBy
    ) {}

    public record AddQuestionRequest(
            @NotBlank String questionText,
            @NotNull QuestionType questionType,
            String imagePath,
            @Min(1) Integer orderNo,
            List<OptionRequest> options
    ) {}

    public record OptionRequest(@NotBlank String optionText, Boolean correct) {}
    public record ExtendExamRequest(@NotNull @Min(1) Integer minutes) {}
    public record JoinExamRequest(Long userId, @NotBlank String nickname, @Email String email) {}
    public record ProgressRequest(@NotNull @Min(0) Integer currentQuestionNo, @NotNull @Min(0) @Max(100) Integer progressPercent) {}
    public record AnswerRequest(@NotNull Long questionId, Long selectedOptionId, String textAnswer) {}

    public record ExamResponse(Long id, String title, String description, Integer duration, ExamStatus status,
                               ExamVisibility visibility, String joinCode, Long createdBy, Instant startTime,
                               Instant scheduledStartTime, Long questionCount) {
        public static ExamResponse from(Exam exam, Long questionCount) {
            return new ExamResponse(
                    exam.getId(),
                    exam.getTitle(),
                    exam.getDescription(),
                    exam.getDuration(),
                    exam.getStatus(),
                    exam.getVisibility(),
                    exam.getJoinCode(),
                    exam.getCreatedBy(),
                    exam.getStartTime(),
                    exam.getScheduledStartTime(),
                    questionCount
            );
        }
    }

    public record QuestionResponse(Long id, String questionText, QuestionType questionType, String imagePath,
                                   Integer orderNo, List<OptionResponse> options) {
        public static QuestionResponse from(Question question) {
            return new QuestionResponse(
                    question.getId(),
                    question.getQuestionText(),
                    question.getQuestionType(),
                    question.getImagePath(),
                    question.getOrderNo(),
                    question.getOptions().stream().map(OptionResponse::from).toList()
            );
        }
    }

    public record OptionResponse(Long id, String optionText, Boolean correct) {
        public static OptionResponse from(QuestionOption option) {
            return new OptionResponse(option.getId(), option.getOptionText(), option.getCorrect());
        }
    }

    public record ParticipantResponse(Long id, Long examId, Long userId, String nickname, String email,
                                      Instant joinedAt, Integer currentQuestionNo, Integer progressPercent,
                                      Instant lastSeenAt, Instant finishedAt) {
        public static ParticipantResponse from(Participant participant) {
            return new ParticipantResponse(
                    participant.getId(),
                    participant.getExam().getId(),
                    participant.getUserId(),
                    participant.getNickname(),
                    participant.getEmail(),
                    participant.getJoinedAt(),
                    participant.getCurrentQuestionNo(),
                    participant.getProgressPercent(),
                    participant.getLastSeenAt(),
                    participant.getFinishedAt()
            );
        }
    }

    public record AnswerResponse(Long id, Long participantId, Long questionId, Long selectedOptionId,
                                 String textAnswer, Boolean correct, Instant answeredAt) {
        public static AnswerResponse from(ParticipantAnswer answer) {
            return new AnswerResponse(
                    answer.getId(),
                    answer.getParticipant().getId(),
                    answer.getQuestion().getId(),
                    answer.getSelectedOption() == null ? null : answer.getSelectedOption().getId(),
                    answer.getTextAnswer(),
                    answer.getCorrect(),
                    answer.getAnsweredAt()
            );
        }
    }
}
