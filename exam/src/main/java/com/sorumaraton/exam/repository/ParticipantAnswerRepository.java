package com.sorumaraton.exam.repository;

import com.sorumaraton.exam.domain.ParticipantAnswer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ParticipantAnswerRepository extends JpaRepository<ParticipantAnswer, Long> {
    Optional<ParticipantAnswer> findByParticipantIdAndQuestionId(Long participantId, Long questionId);
    List<ParticipantAnswer> findByParticipantExamId(Long examId);
    List<ParticipantAnswer> findByParticipantId(Long participantId);
}
