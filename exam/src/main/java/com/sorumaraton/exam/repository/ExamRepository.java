package com.sorumaraton.exam.repository;

import com.sorumaraton.exam.domain.Exam;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface ExamRepository extends JpaRepository<Exam, Long> {
    Optional<Exam> findByJoinCode(String joinCode);
}
