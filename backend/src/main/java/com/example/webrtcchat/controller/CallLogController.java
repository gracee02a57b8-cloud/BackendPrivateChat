package com.example.webrtcchat.controller;

import com.example.webrtcchat.entity.CallLogEntity;
import com.example.webrtcchat.repository.CallLogRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/calls")
public class CallLogController {

    private final CallLogRepository callLogRepository;

    public CallLogController(CallLogRepository callLogRepository) {
        this.callLogRepository = callLogRepository;
    }

    @GetMapping("/history")
    public ResponseEntity<List<CallLogEntity>> getCallHistory(
            Principal principal,
            @RequestParam(defaultValue = "50") int limit) {
        int safeLimit = Math.min(limit, 200);
        List<CallLogEntity> logs = callLogRepository.findByUsername(
                principal.getName(), PageRequest.of(0, safeLimit));
        return ResponseEntity.ok(logs);
    }
}
