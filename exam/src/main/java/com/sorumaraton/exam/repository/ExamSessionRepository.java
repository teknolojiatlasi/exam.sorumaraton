package com.sorumaraton.exam.repository;

import com.sorumaraton.exam.domain.ExamSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ExamSessionRepository extends JpaRepository<ExamSession, Long> {
    Optional<ExamSession> findByExamId(Long examId);
    void deleteByExamId(Long examId);
}
