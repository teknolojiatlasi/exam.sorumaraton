package com.sorumaraton.exam.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class ExamEventPublisher {
    private final SimpMessagingTemplate messagingTemplate;
    private final StringRedisTemplate redisTemplate;

    public void publish(Long examId, String type, Map<String, ?> payload) {
        messagingTemplate.convertAndSend("/topic/exams/" + examId + "/events", payload);
        try {
            redisTemplate.convertAndSend("exam-events", type + ":" + examId);
        } catch (RedisConnectionFailureException ignored) {
            // Local development and tests can run without Redis; WebSocket delivery still works.
        }
    }
}
