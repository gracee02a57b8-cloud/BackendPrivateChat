package com.example.webrtcchat.service;

import com.example.webrtcchat.dto.UserDto;
import com.example.webrtcchat.entity.MessageEntity;
import com.example.webrtcchat.entity.NewsEntity;
import com.example.webrtcchat.entity.ReactionEntity;
import com.example.webrtcchat.entity.UserEntity;
import com.example.webrtcchat.repository.MessageRepository;
import com.example.webrtcchat.repository.NewsCommentRepository;
import com.example.webrtcchat.repository.NewsRepository;
import com.example.webrtcchat.repository.ReactionRepository;
import com.example.webrtcchat.repository.RoomRepository;
import com.example.webrtcchat.repository.UserRepository;
import com.example.webrtcchat.types.MessageType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Tests for critical performance fixes:
 * B1 — batch getUsersInfo (eliminates N+1 on /api/chat/users)
 * B5 — batch getReactionsForMessages (single query instead of N)
 * B6 — batch comment counts in NewsService.getAllNews
 */
@ExtendWith(MockitoExtension.class)
class PerformanceFeaturesTest {

    // ═══════════════════════════════════════════
    // B1: ChatService.getUsersInfo — batch user loading
    // ═══════════════════════════════════════════

    @Nested
    @DisplayName("B1: ChatService.getUsersInfo")
    class BatchGetUsersInfo {

        @Mock private MessageRepository messageRepository;
        @Mock private RoomRepository roomRepository;
        @Mock private UserRepository userRepository;
        @Mock private PollService pollService;
        @InjectMocks private ChatService chatService;

        @Test
        @DisplayName("batch loads users via single findByUsernameIn query")
        void batchLoads_singleQuery() {
            UserEntity alice = new UserEntity("alice", "pass", "2026-01-01");
            alice.setLastSeen("2026-01-01 12:00:00");
            alice.setAvatarUrl("/img/alice.png");
            alice.setTag("@alice");

            UserEntity bob = new UserEntity("bob", "pass", "2026-01-01");
            bob.setLastSeen("2026-01-01 11:00:00");
            bob.setAvatarUrl("/img/bob.png");
            bob.setTag("@bob");

            when(userRepository.findByUsernameIn(List.of("alice", "bob")))
                    .thenReturn(List.of(alice, bob));

            chatService.addUser("alice"); // mark alice online

            List<UserDto> result = chatService.getUsersInfo(List.of("alice", "bob"));

            assertEquals(2, result.size());

            UserDto aliceDto = result.get(0);
            assertEquals("alice", aliceDto.getUsername());
            assertTrue(aliceDto.isOnline());
            assertEquals("2026-01-01 12:00:00", aliceDto.getLastSeen());
            assertEquals("/img/alice.png", aliceDto.getAvatarUrl());
            assertEquals("@alice", aliceDto.getTag());

            UserDto bobDto = result.get(1);
            assertEquals("bob", bobDto.getUsername());
            assertFalse(bobDto.isOnline());
            assertEquals("2026-01-01 11:00:00", bobDto.getLastSeen());
            assertEquals("/img/bob.png", bobDto.getAvatarUrl());
            assertEquals("@bob", bobDto.getTag());

            // Verify SINGLE batch query, not N individual findByUsername calls
            verify(userRepository, times(1)).findByUsernameIn(anyList());
            verify(userRepository, never()).findByUsername(anyString());
        }

        @Test
        @DisplayName("handles unknown usernames gracefully")
        void handlesUnknownUsers() {
            when(userRepository.findByUsernameIn(List.of("alice", "ghost")))
                    .thenReturn(List.of(new UserEntity("alice", "pass", "2026-01-01")));

            List<UserDto> result = chatService.getUsersInfo(List.of("alice", "ghost"));

            assertEquals(2, result.size());
            assertEquals("ghost", result.get(1).getUsername());
            assertNull(result.get(1).getLastSeen());
            assertNull(result.get(1).getAvatarUrl());
            assertNull(result.get(1).getTag());
        }

        @Test
        @DisplayName("returns empty list for null input")
        void nullInput_returnsEmpty() {
            List<UserDto> result = chatService.getUsersInfo(null);
            assertTrue(result.isEmpty());
        }

        @Test
        @DisplayName("returns empty list for empty input")
        void emptyInput_returnsEmpty() {
            List<UserDto> result = chatService.getUsersInfo(List.of());
            assertTrue(result.isEmpty());
        }

        @Test
        @DisplayName("preserves input order in result")
        void preservesOrder() {
            UserEntity alice = new UserEntity("alice", "pass", "2026-01-01");
            UserEntity bob = new UserEntity("bob", "pass", "2026-01-01");
            UserEntity charlie = new UserEntity("charlie", "pass", "2026-01-01");

            when(userRepository.findByUsernameIn(List.of("charlie", "alice", "bob")))
                    .thenReturn(List.of(alice, bob, charlie));

            List<UserDto> result = chatService.getUsersInfo(List.of("charlie", "alice", "bob"));

            assertEquals("charlie", result.get(0).getUsername());
            assertEquals("alice", result.get(1).getUsername());
            assertEquals("bob", result.get(2).getUsername());
        }

        @Test
        @DisplayName("handles duplicate usernames without error")
        void handlesDuplicateUsernames() {
            UserEntity alice = new UserEntity("alice", "pass", "2026-01-01");
            when(userRepository.findByUsernameIn(List.of("alice", "alice")))
                    .thenReturn(List.of(alice));

            List<UserDto> result = chatService.getUsersInfo(List.of("alice", "alice"));
            assertEquals(2, result.size());
            assertEquals("alice", result.get(0).getUsername());
            assertEquals("alice", result.get(1).getUsername());
        }
    }

    // ═══════════════════════════════════════════
    // B5: ReactionService.getReactionsForMessages — batch reactions
    // ═══════════════════════════════════════════

    @Nested
    @DisplayName("B5: ReactionService.getReactionsForMessages")
    class BatchReactions {

        @Mock private ReactionRepository reactionRepository;
        @InjectMocks private ReactionService reactionService;

        @Test
        @DisplayName("batch loads reactions for multiple messages in single query")
        void batchLoads_singleQuery() {
            ReactionEntity r1 = makeReaction("msg1", "alice", "👍");
            ReactionEntity r2 = makeReaction("msg1", "bob", "👍");
            ReactionEntity r3 = makeReaction("msg2", "alice", "❤️");

            when(reactionRepository.findByMessageIdIn(List.of("msg1", "msg2")))
                    .thenReturn(List.of(r1, r2, r3));

            Map<String, List<Map<String, Object>>> result =
                    reactionService.getReactionsForMessages(List.of("msg1", "msg2"));

            assertEquals(2, result.size());

            // msg1 should have 1 emoji group with 2 users
            List<Map<String, Object>> msg1Reactions = result.get("msg1");
            assertEquals(1, msg1Reactions.size());
            assertEquals("👍", msg1Reactions.get(0).get("emoji"));
            assertEquals(2, (int) msg1Reactions.get(0).get("count"));

            // msg2 should have 1 emoji group with 1 user
            List<Map<String, Object>> msg2Reactions = result.get("msg2");
            assertEquals(1, msg2Reactions.size());
            assertEquals("❤️", msg2Reactions.get(0).get("emoji"));
            assertEquals(1, (int) msg2Reactions.get(0).get("count"));

            // Verify SINGLE batch query
            verify(reactionRepository, times(1)).findByMessageIdIn(anyCollection());
            verify(reactionRepository, never()).findByMessageId(anyString());
        }

        @Test
        @DisplayName("returns empty map for empty input")
        void emptyInput_returnsEmpty() {
            Map<String, List<Map<String, Object>>> result =
                    reactionService.getReactionsForMessages(List.of());
            assertTrue(result.isEmpty());
        }

        @Test
        @DisplayName("returns empty map for null input")
        void nullInput_returnsEmpty() {
            Map<String, List<Map<String, Object>>> result =
                    reactionService.getReactionsForMessages(null);
            assertTrue(result.isEmpty());
        }

        @Test
        @DisplayName("messages with no reactions are not present in result map")
        void noReactions_notInMap() {
            when(reactionRepository.findByMessageIdIn(List.of("msg1", "msg2")))
                    .thenReturn(List.of());

            Map<String, List<Map<String, Object>>> result =
                    reactionService.getReactionsForMessages(List.of("msg1", "msg2"));

            assertTrue(result.isEmpty());
        }

        @Test
        @DisplayName("multiple emojis per message grouped correctly")
        void multipleEmojisPerMessage() {
            ReactionEntity r1 = makeReaction("msg1", "alice", "👍");
            ReactionEntity r2 = makeReaction("msg1", "bob", "❤️");
            ReactionEntity r3 = makeReaction("msg1", "charlie", "👍");

            when(reactionRepository.findByMessageIdIn(List.of("msg1")))
                    .thenReturn(List.of(r1, r2, r3));

            Map<String, List<Map<String, Object>>> result =
                    reactionService.getReactionsForMessages(List.of("msg1"));

            List<Map<String, Object>> msg1Reactions = result.get("msg1");
            assertEquals(2, msg1Reactions.size()); // 2 emoji groups

            // Find the thumbs-up group
            Map<String, Object> thumbsUp = msg1Reactions.stream()
                    .filter(r -> "👍".equals(r.get("emoji"))).findFirst().orElseThrow();
            assertEquals(2, (int) thumbsUp.get("count"));

            // Find the heart group
            Map<String, Object> heart = msg1Reactions.stream()
                    .filter(r -> "❤️".equals(r.get("emoji"))).findFirst().orElseThrow();
            assertEquals(1, (int) heart.get("count"));
        }

        private ReactionEntity makeReaction(String messageId, String username, String emoji) {
            ReactionEntity r = new ReactionEntity();
            r.setMessageId(messageId);
            r.setUsername(username);
            r.setEmoji(emoji);
            r.setRoomId("room1");
            r.setCreatedAt("2026-01-01 12:00:00");
            return r;
        }
    }

    // ═══════════════════════════════════════════
    // B6: NewsService.getAllNews — batch comment counts
    // ═══════════════════════════════════════════

    @Nested
    @DisplayName("B6: NewsService.getAllNews batch comment counts")
    class BatchNewsCommentCounts {

        @Mock private NewsRepository newsRepository;
        @Mock private NewsCommentRepository commentRepository;
        @InjectMocks private NewsService newsService;

        @Test
        @DisplayName("batch loads comment counts in single query instead of N+1")
        void batchLoads_singleQuery() {
            NewsEntity n1 = makeNews("n1", "alice", "Title1");
            NewsEntity n2 = makeNews("n2", "bob", "Title2");
            NewsEntity n3 = makeNews("n3", "alice", "Title3");

            when(newsRepository.findAllByOrderByCreatedAtDesc())
                    .thenReturn(List.of(n1, n2, n3));
            when(commentRepository.countByNewsIdIn(List.of("n1", "n2", "n3")))
                    .thenReturn(List.of(
                            new Object[]{"n1", 5L},
                            new Object[]{"n3", 2L}
                    ));

            var result = newsService.getAllNews();

            assertEquals(3, result.size());
            assertEquals(5L, result.get(0).getCommentCount()); // n1 = 5
            assertEquals(0L, result.get(1).getCommentCount()); // n2 = 0 (no row)
            assertEquals(2L, result.get(2).getCommentCount()); // n3 = 2

            // Verify SINGLE batch query
            verify(commentRepository, times(1)).countByNewsIdIn(anyList());
            verify(commentRepository, never()).countByNewsId(anyString());
        }

        @Test
        @DisplayName("returns empty list when no news exist")
        void emptyNews_returnsEmpty() {
            when(newsRepository.findAllByOrderByCreatedAtDesc())
                    .thenReturn(List.of());

            var result = newsService.getAllNews();
            assertTrue(result.isEmpty());

            // Should NOT call countByNewsIdIn at all
            verify(commentRepository, never()).countByNewsIdIn(anyList());
        }

        @Test
        @DisplayName("all news have zero comments when batch returns empty")
        void zeroCounts() {
            NewsEntity n1 = makeNews("n1", "alice", "Title");
            when(newsRepository.findAllByOrderByCreatedAtDesc())
                    .thenReturn(List.of(n1));
            when(commentRepository.countByNewsIdIn(List.of("n1")))
                    .thenReturn(List.of());

            var result = newsService.getAllNews();
            assertEquals(1, result.size());
            assertEquals(0L, result.get(0).getCommentCount());
        }

        private NewsEntity makeNews(String id, String author, String title) {
            NewsEntity e = new NewsEntity();
            e.setId(id);
            e.setAuthor(author);
            e.setTitle(title);
            e.setContent("Content");
            e.setCreatedAt("2026-01-01 12:00:00");
            return e;
        }
    }
}
