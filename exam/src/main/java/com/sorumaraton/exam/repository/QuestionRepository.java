package com.sorumaraton.exam.repository;

import com.sorumaraton.exam.domain.Question;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface QuestionRepository extends JpaRepository<Question, Long> {
    @EntityGraph(attributePaths = "options")
    List<Question> findByExamIdOrderByOrderNoAsc(Long examId);
    long countByExamId(Long examId);
}
