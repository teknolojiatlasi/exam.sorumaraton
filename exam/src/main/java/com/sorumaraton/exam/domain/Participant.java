package com.sorumaraton.exam.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "participants")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Participant {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exam_id")
    private Exam exam;

    private Long userId;

    @Column(nullable = false)
    private String nickname;

    private String email;
    private Instant joinedAt;
    private Integer currentQuestionNo;
    private Integer progressPercent;
    private Instant lastSeenAt;
    private Instant finishedAt;
}
