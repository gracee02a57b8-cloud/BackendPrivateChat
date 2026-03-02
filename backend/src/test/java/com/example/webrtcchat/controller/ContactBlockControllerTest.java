package com.example.webrtcchat.controller;

import com.example.webrtcchat.entity.ContactEntity;
import com.example.webrtcchat.entity.UserEntity;
import com.example.webrtcchat.repository.BlockedUserRepository;
import com.example.webrtcchat.repository.ContactRepository;
import com.example.webrtcchat.repository.UserRepository;
import com.example.webrtcchat.service.ChatService;
import com.example.webrtcchat.service.JwtService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.security.Principal;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ContactBlockController.class)
@AutoConfigureMockMvc(addFilters = false)
class ContactBlockControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ContactRepository contactRepository;

    @MockBean
    private BlockedUserRepository blockedUserRepository;

    @MockBean
    private UserRepository userRepository;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private ChatService chatService;

    // P1-9: controller now uses Principal, so we use .principal() instead of @RequestHeader
    private static Principal principal(String name) {
        return () -> name;
    }

    // ════════════════════════════════════════════
    //  POST /api/contacts/{target} — add contact
    // ════════════════════════════════════════════

    @Nested
    @DisplayName("POST /api/contacts/{target}")
    class AddContact {

        @Test
        @DisplayName("success — adds contact and returns 'added'")
        void addContact_success() throws Exception {
            when(userRepository.findByUsername("bob")).thenReturn(Optional.of(new UserEntity("bob", "pwd", "now")));
            when(contactRepository.existsByOwnerAndContact("alice", "bob")).thenReturn(false);

            mockMvc.perform(post("/api/contacts/bob").principal(principal("alice")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("added"));

            verify(contactRepository).save(any(ContactEntity.class));
        }

        @Test
        @DisplayName("duplicate — returns 'already_contact' without saving")
        void addContact_duplicate() throws Exception {
            when(userRepository.findByUsername("bob")).thenReturn(Optional.of(new UserEntity("bob", "pwd", "now")));
            when(contactRepository.existsByOwnerAndContact("alice", "bob")).thenReturn(true);

            mockMvc.perform(post("/api/contacts/bob").principal(principal("alice")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("already_contact"));

            verify(contactRepository, never()).save(any());
        }

        @Test
        @DisplayName("self — returns 400")
        void addContact_self() throws Exception {
            mockMvc.perform(post("/api/contacts/alice").principal(principal("alice")))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("Cannot add yourself"));
        }

        @Test
        @DisplayName("user not found — returns 404")
        void addContact_notFound() throws Exception {
            when(userRepository.findByUsername("ghost")).thenReturn(Optional.empty());

            mockMvc.perform(post("/api/contacts/ghost").principal(principal("alice")))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error").value("User not found"));
        }


    }

    // ════════════════════════════════════════════
    //  DELETE /api/contacts/{target} — remove contact
    // ════════════════════════════════════════════

    @Nested
    @DisplayName("DELETE /api/contacts/{target}")
    class RemoveContact {

        @Test
        @DisplayName("success — removes and returns 'removed'")
        void removeContact_success() throws Exception {
            mockMvc.perform(delete("/api/contacts/bob").principal(principal("alice")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("removed"));

            verify(contactRepository).deleteByOwnerAndContact("alice", "bob");
        }


    }

    // ════════════════════════════════════════════
    //  GET /api/contacts — list contacts
    // ════════════════════════════════════════════

    @Nested
    @DisplayName("GET /api/contacts")
    class GetContacts {

        @Test
        @DisplayName("returns enriched contact list using batch load (audit 3.2)")
        void getContacts_success() throws Exception {
            ContactEntity c = new ContactEntity("alice", "bob", "2026-01-01 12:00:00");
            when(contactRepository.findByOwner("alice")).thenReturn(List.of(c));

            UserEntity bobUser = new UserEntity("bob", "pwd", "now");
            bobUser.setFirstName("Bob");
            bobUser.setLastName("Smith");
            bobUser.setTag("#dev");
            // batch load via findByUsernameIn (audit 3.2 — N+1 fix)
            when(userRepository.findByUsernameIn(List.of("bob"))).thenReturn(List.of(bobUser));
            when(chatService.isUserOnline("bob")).thenReturn(true);
            when(chatService.getLastSeen("bob")).thenReturn("2026-01-01 12:00:00");

            mockMvc.perform(get("/api/contacts").principal(principal("alice")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].contact").value("bob"))
                    .andExpect(jsonPath("$[0].firstName").value("Bob"))
                    .andExpect(jsonPath("$[0].lastName").value("Smith"))
                    .andExpect(jsonPath("$[0].tag").value("#dev"))
                    .andExpect(jsonPath("$[0].online").value(true));

            // Must use batch method, NOT individual findByUsername
            verify(userRepository).findByUsernameIn(List.of("bob"));
            verify(userRepository, never()).findByUsername("bob");
        }

        @Test
        @DisplayName("multiple contacts — batch loads all in one query (audit 3.2)")
        void getContacts_batchLoadsMultiple() throws Exception {
            ContactEntity c1 = new ContactEntity("alice", "bob", "2026-01-01 12:00:00");
            ContactEntity c2 = new ContactEntity("alice", "charlie", "2026-01-01 13:00:00");
            when(contactRepository.findByOwner("alice")).thenReturn(List.of(c1, c2));

            UserEntity bobUser = new UserEntity("bob", "pwd", "now");
            bobUser.setFirstName("Bob");
            UserEntity charlieUser = new UserEntity("charlie", "pwd", "now");
            charlieUser.setFirstName("Charlie");
            when(userRepository.findByUsernameIn(List.of("bob", "charlie")))
                    .thenReturn(List.of(bobUser, charlieUser));
            when(chatService.isUserOnline(anyString())).thenReturn(false);
            when(chatService.getLastSeen(anyString())).thenReturn("2026-01-01 12:00:00");

            mockMvc.perform(get("/api/contacts").principal(principal("alice")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].contact").value("bob"))
                    .andExpect(jsonPath("$[0].firstName").value("Bob"))
                    .andExpect(jsonPath("$[1].contact").value("charlie"))
                    .andExpect(jsonPath("$[1].firstName").value("Charlie"));

            // Exactly ONE batch call, zero individual calls
            verify(userRepository, times(1)).findByUsernameIn(anyList());
            verify(userRepository, never()).findByUsername(anyString());
        }

        @Test
        @DisplayName("returns empty list when no contacts")
        void getContacts_empty() throws Exception {
            when(contactRepository.findByOwner("alice")).thenReturn(List.of());

            mockMvc.perform(get("/api/contacts").principal(principal("alice")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$").isArray())
                    .andExpect(jsonPath("$").isEmpty());

            // No batch call when there are no contacts
            verify(userRepository, never()).findByUsernameIn(anyList());
        }
    }

    // ════════════════════════════════════════════
    //  GET /api/profile/{target} — view profile
    // ════════════════════════════════════════════

    @Nested
    @DisplayName("GET /api/profile/{target}")
    class GetProfile {

        @Test
        @DisplayName("returns profile with isContact = true")
        void getProfile_isContact() throws Exception {
            UserEntity bob = new UserEntity("bob", "pwd", "now");
            bob.setFirstName("Bob");
            bob.setLastName("Smith");
            bob.setBio("Hello world");
            bob.setTag("#dev");
            when(userRepository.findByUsername("bob")).thenReturn(Optional.of(bob));
            when(contactRepository.existsByOwnerAndContact("alice", "bob")).thenReturn(true);
            when(blockedUserRepository.existsByBlockerAndBlocked("alice", "bob")).thenReturn(false);

            mockMvc.perform(get("/api/profile/bob").principal(principal("alice")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.username").value("bob"))
                    .andExpect(jsonPath("$.firstName").value("Bob"))
                    .andExpect(jsonPath("$.bio").value("Hello world"))
                    .andExpect(jsonPath("$.isContact").value(true))
                    .andExpect(jsonPath("$.iBlockedByMe").value(false));
        }

        @Test
        @DisplayName("returns profile with isContact = false")
        void getProfile_notContact() throws Exception {
            UserEntity bob = new UserEntity("bob", "pwd", "now");
            when(userRepository.findByUsername("bob")).thenReturn(Optional.of(bob));
            when(contactRepository.existsByOwnerAndContact("alice", "bob")).thenReturn(false);
            when(blockedUserRepository.existsByBlockerAndBlocked("alice", "bob")).thenReturn(false);

            mockMvc.perform(get("/api/profile/bob").principal(principal("alice")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.isContact").value(false));
        }

        @Test
        @DisplayName("user not found — returns 404")
        void getProfile_notFound() throws Exception {
            when(userRepository.findByUsername("ghost")).thenReturn(Optional.empty());

            mockMvc.perform(get("/api/profile/ghost").principal(principal("alice")))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error").value("User not found"));
        }
    }
}
