package com.sorumaraton.exam.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "exams")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Exam {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String title;
    private String description;
    private Integer duration;
    @Enumerated(EnumType.STRING)
    private ExamStatus status;
    @Enumerated(EnumType.STRING)
    private ExamVisibility visibility;
    private String joinCode;
    private Long createdBy;
    private Instant startTime;
    private Instant scheduledStartTime;

    @Builder.Default
    @OneToMany(mappedBy = "exam", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderNo ASC")
    private List<Question> questions = new ArrayList<>();
}
