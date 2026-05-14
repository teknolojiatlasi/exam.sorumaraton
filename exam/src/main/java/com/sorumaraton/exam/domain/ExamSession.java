package com.sorumaraton.exam.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "exam_sessions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ExamSession {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exam_id", unique = true)
    private Exam exam;

    private Instant startedAt;
    private Instant endedAt;
    private Integer extendedMinutes;
}
