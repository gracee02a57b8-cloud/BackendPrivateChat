package com.example.webrtcchat.controller;

import com.example.webrtcchat.dto.StoryDto;
import com.example.webrtcchat.service.StoryService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/stories")
public class StoryController {

    private final StoryService storyService;

    public StoryController(StoryService storyService) {
        this.storyService = storyService;
    }

    /**
     * GET /api/stories — list all active stories for the current user.
     */
    @GetMapping
    public ResponseEntity<List<StoryDto>> getStories(Principal principal) {
        return ResponseEntity.ok(storyService.getAllActiveStories(principal.getName()));
    }

    /**
     * POST /api/stories — create a new story.
     * Body: { videoUrl, thumbnailUrl?, duration? }
     */
    @PostMapping
    public ResponseEntity<?> createStory(@RequestBody Map<String, Object> body, Principal principal) {
        String videoUrl = (String) body.get("videoUrl");
        String thumbnailUrl = (String) body.get("thumbnailUrl");
        int duration = 0;
        if (body.get("duration") instanceof Number) {
            duration = ((Number) body.get("duration")).intValue();
        }

        if (videoUrl == null || videoUrl.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "videoUrl is required"));
        }

        StoryDto dto = storyService.createStory(principal.getName(), videoUrl.trim(), thumbnailUrl, duration);
        if (dto == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Максимум 5 историй. Удалите старые."));
        }

        return ResponseEntity.ok(dto);
    }

    /**
     * POST /api/stories/{id}/view — mark a story as viewed.
     */
    @PostMapping("/{id}/view")
    public ResponseEntity<Void> viewStory(@PathVariable String id, Principal principal) {
        storyService.viewStory(id, principal.getName());
        return ResponseEntity.ok().build();
    }

    /**
     * GET /api/stories/{id}/viewers — get list of viewers (author only).
     */
    @GetMapping("/{id}/viewers")
    public ResponseEntity<List<StoryDto.StoryViewDto>> getViewers(@PathVariable String id, Principal principal) {
        // Only story author can see viewers list
        StoryDto story = storyService.getStoryById(id);
        if (story == null) {
            return ResponseEntity.notFound().build();
        }
        if (!story.getAuthor().equals(principal.getName())) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(storyService.getStoryViewers(id));
    }

    /**
     * DELETE /api/stories/{id} — delete own story.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteStory(@PathVariable String id, Principal principal) {
        boolean deleted = storyService.deleteStory(id, principal.getName());
        if (!deleted) {
            return ResponseEntity.badRequest().body(Map.of("error", "Story not found or not yours"));
        }
        return ResponseEntity.ok(Map.of("success", true));
    }
}
