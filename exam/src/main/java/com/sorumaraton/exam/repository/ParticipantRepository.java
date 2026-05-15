package com.sorumaraton.exam.repository;

import com.sorumaraton.exam.domain.Participant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ParticipantRepository extends JpaRepository<Participant, Long> {
    List<Participant> findByExamIdOrderByJoinedAtAsc(Long examId);
    long countByExamId(Long examId);
    void deleteByExamId(Long examId);
}
