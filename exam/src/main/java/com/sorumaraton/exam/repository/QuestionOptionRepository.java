package com.sorumaraton.exam.repository;

import com.sorumaraton.exam.domain.QuestionOption;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QuestionOptionRepository extends JpaRepository<QuestionOption, Long> {
}
