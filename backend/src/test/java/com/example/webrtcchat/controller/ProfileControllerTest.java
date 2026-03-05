package com.example.webrtcchat.controller;

import com.example.webrtcchat.entity.UserEntity;
import com.example.webrtcchat.repository.UserRepository;
import com.example.webrtcchat.service.ChatService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.security.Principal;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ProfileController.class)
@AutoConfigureMockMvc(addFilters = false)
class ProfileControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ChatService chatService;

    @MockBean
    private UserRepository userRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private UserEntity createTestUser() {
        UserEntity user = new UserEntity("testuser", "password", "2026-01-01");
        user.setId(1L);
        user.setFirstName("Иван");
        user.setLastName("Петров");
        user.setPhone("+7 999 123-45-67");
        user.setBio("Привет! Я тестовый пользователь");
        user.setTag("@testuser");
        user.setAvatarUrl("/api/uploads/avatar_test.jpg");
        user.setProfileColor("#3b82f6");
        user.setBirthday("1990-05-15");
        return user;
    }

    // ================================================================
    // GET /api/profile — получение своего профиля
    // ================================================================
    @Nested
    @DisplayName("GET /api/profile")
    class GetProfile {

        @Test
        @DisplayName("returns full profile for authenticated user")
        void getProfile_success() throws Exception {
            UserEntity user = createTestUser();
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));

            mockMvc.perform(get("/api/profile").principal(() -> "testuser"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.username").value("testuser"))
                    .andExpect(jsonPath("$.firstName").value("Иван"))
                    .andExpect(jsonPath("$.lastName").value("Петров"))
                    .andExpect(jsonPath("$.phone").value("+7 999 123-45-67"))
                    .andExpect(jsonPath("$.bio").value("Привет! Я тестовый пользователь"))
                    .andExpect(jsonPath("$.tag").value("@testuser"))
                    .andExpect(jsonPath("$.avatarUrl").value("/api/uploads/avatar_test.jpg"))
                    .andExpect(jsonPath("$.profileColor").value("#3b82f6"))
                    .andExpect(jsonPath("$.birthday").value("1990-05-15"));
        }

        @Test
        @DisplayName("returns 404 for non-existent user")
        void getProfile_notFound() throws Exception {
            when(userRepository.findByUsername("ghostuser")).thenReturn(Optional.empty());

            mockMvc.perform(get("/api/profile").principal(() -> "ghostuser"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error").value("User not found"));
        }

        @Test
        @DisplayName("returns empty strings for null fields")
        void getProfile_nullFields() throws Exception {
            UserEntity user = new UserEntity("minuser", "pass", "2026-01-01");
            user.setId(2L);
            when(userRepository.findByUsername("minuser")).thenReturn(Optional.of(user));

            mockMvc.perform(get("/api/profile").principal(() -> "minuser"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.username").value("minuser"))
                    .andExpect(jsonPath("$.firstName").value(""))
                    .andExpect(jsonPath("$.lastName").value(""))
                    .andExpect(jsonPath("$.phone").value(""))
                    .andExpect(jsonPath("$.bio").value(""))
                    .andExpect(jsonPath("$.tag").value(""))
                    .andExpect(jsonPath("$.avatarUrl").value(""));
        }
    }

    // ================================================================
    // PUT /api/profile — обновление профиля
    // ================================================================
    @Nested
    @DisplayName("PUT /api/profile")
    class UpdateProfile {

        @Test
        @DisplayName("updates firstName successfully")
        void updateFirstName() throws Exception {
            UserEntity user = createTestUser();
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));
            when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));

            mockMvc.perform(put("/api/profile")
                            .principal(() -> "testuser")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("firstName", "Алексей"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.firstName").value("Алексей"));

            verify(userRepository).save(any(UserEntity.class));
        }

        @Test
        @DisplayName("updates lastName successfully")
        void updateLastName() throws Exception {
            UserEntity user = createTestUser();
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));
            when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));

            mockMvc.perform(put("/api/profile")
                            .principal(() -> "testuser")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("lastName", "Сидоров"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.lastName").value("Сидоров"));
        }

        @Test
        @DisplayName("updates phone successfully")
        void updatePhone() throws Exception {
            UserEntity user = createTestUser();
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));
            when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));

            mockMvc.perform(put("/api/profile")
                            .principal(() -> "testuser")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("phone", "+7 800 555-35-35"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.phone").value("+7 800 555-35-35"));
        }

        @Test
        @DisplayName("updates bio successfully")
        void updateBio() throws Exception {
            UserEntity user = createTestUser();
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));
            when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));

            mockMvc.perform(put("/api/profile")
                            .principal(() -> "testuser")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("bio", "Новое описание о себе"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.bio").value("Новое описание о себе"));
        }

        @Test
        @DisplayName("updates tag successfully")
        void updateTag() throws Exception {
            UserEntity user = createTestUser();
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));
            when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));
            when(userRepository.existsByTag("@newtag")).thenReturn(false);

            mockMvc.perform(put("/api/profile")
                            .principal(() -> "testuser")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("tag", "newtag"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.tag").value("@newtag"));
        }

        @Test
        @DisplayName("rejects duplicate tag")
        void updateTag_duplicate() throws Exception {
            UserEntity user = createTestUser();
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));
            when(userRepository.existsByTag("@taken")).thenReturn(true);

            mockMvc.perform(put("/api/profile")
                            .principal(() -> "testuser")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("tag", "taken"))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("Тег уже занят"));
        }

        @Test
        @DisplayName("updates multiple fields at once")
        void updateMultipleFields() throws Exception {
            UserEntity user = createTestUser();
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));
            when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));

            mockMvc.perform(put("/api/profile")
                            .principal(() -> "testuser")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of(
                                    "firstName", "Новое",
                                    "lastName", "ИмяФамилия",
                                    "phone", "+7 111 222-33-44",
                                    "bio", "Обновлённое описание"
                            ))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.firstName").value("Новое"))
                    .andExpect(jsonPath("$.lastName").value("ИмяФамилия"))
                    .andExpect(jsonPath("$.phone").value("+7 111 222-33-44"))
                    .andExpect(jsonPath("$.bio").value("Обновлённое описание"));
        }

        @Test
        @DisplayName("rejects firstName over 50 chars")
        void updateFirstName_tooLong() throws Exception {
            UserEntity user = createTestUser();
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));

            mockMvc.perform(put("/api/profile")
                            .principal(() -> "testuser")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("firstName", "A".repeat(51)))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("Имя не более 50 символов"));
        }

        @Test
        @DisplayName("rejects lastName over 50 chars")
        void updateLastName_tooLong() throws Exception {
            UserEntity user = createTestUser();
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));

            mockMvc.perform(put("/api/profile")
                            .principal(() -> "testuser")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("lastName", "B".repeat(51)))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("Фамилия не более 50 символов"));
        }

        @Test
        @DisplayName("rejects phone over 30 chars")
        void updatePhone_tooLong() throws Exception {
            UserEntity user = createTestUser();
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));

            mockMvc.perform(put("/api/profile")
                            .principal(() -> "testuser")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("phone", "1".repeat(31)))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("Номер не более 30 символов"));
        }

        @Test
        @DisplayName("rejects bio over 500 chars")
        void updateBio_tooLong() throws Exception {
            UserEntity user = createTestUser();
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));

            mockMvc.perform(put("/api/profile")
                            .principal(() -> "testuser")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("bio", "X".repeat(501)))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("О себе не более 500 символов"));
        }

        @Test
        @DisplayName("rejects tag over 30 chars")
        void updateTag_tooLong() throws Exception {
            UserEntity user = createTestUser();
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));

            mockMvc.perform(put("/api/profile")
                            .principal(() -> "testuser")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("tag", "T".repeat(31)))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("Тег не более 30 символов"));
        }

        @Test
        @DisplayName("rejects invalid birthday format")
        void updateBirthday_invalidFormat() throws Exception {
            UserEntity user = createTestUser();
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));

            mockMvc.perform(put("/api/profile")
                            .principal(() -> "testuser")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("birthday", "15/05/1990"))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("Формат даты: YYYY-MM-DD"));
        }

        @Test
        @DisplayName("rejects invalid profileColor format")
        void updateProfileColor_invalidFormat() throws Exception {
            UserEntity user = createTestUser();
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));

            mockMvc.perform(put("/api/profile")
                            .principal(() -> "testuser")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("profileColor", "red"))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("Формат цвета: #RRGGBB"));
        }

        @Test
        @DisplayName("returns 404 for non-existent user")
        void updateProfile_notFound() throws Exception {
            when(userRepository.findByUsername("ghost")).thenReturn(Optional.empty());

            mockMvc.perform(put("/api/profile")
                            .principal(() -> "ghost")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("firstName", "Test"))))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error").value("User not found"));
        }
    }

    // ================================================================
    // POST /api/profile/avatar — загрузка аватара
    // ================================================================
    @Nested
    @DisplayName("POST /api/profile/avatar")
    class UploadAvatar {

        @Test
        @DisplayName("uploads avatar successfully")
        void uploadAvatar_success() throws Exception {
            UserEntity user = createTestUser();
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));
            when(chatService.getAvatarUrl("testuser")).thenReturn(null);

            MockMultipartFile file = new MockMultipartFile(
                    "file", "avatar.jpg", "image/jpeg",
                    new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0, 0, 0}
            );

            mockMvc.perform(multipart("/api/profile/avatar")
                            .file(file)
                            .principal(() -> "testuser"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.avatarUrl").exists());

            verify(chatService).updateAvatarUrl(eq("testuser"), anyString());
        }

        @Test
        @DisplayName("rejects empty file")
        void uploadAvatar_emptyFile() throws Exception {
            MockMultipartFile file = new MockMultipartFile(
                    "file", "empty.jpg", "image/jpeg", new byte[0]
            );

            mockMvc.perform(multipart("/api/profile/avatar")
                            .file(file)
                            .principal(() -> "testuser"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("Файл пустой"));
        }

        @Test
        @DisplayName("rejects file over 5MB")
        void uploadAvatar_tooLarge() throws Exception {
            byte[] largeContent = new byte[6 * 1024 * 1024]; // 6MB
            MockMultipartFile file = new MockMultipartFile(
                    "file", "large.jpg", "image/jpeg", largeContent
            );

            mockMvc.perform(multipart("/api/profile/avatar")
                            .file(file)
                            .principal(() -> "testuser"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("Макс. размер аватара 5 МБ"));
        }

        @Test
        @DisplayName("rejects non-image file extension")
        void uploadAvatar_badExtension() throws Exception {
            MockMultipartFile file = new MockMultipartFile(
                    "file", "script.exe", "application/octet-stream",
                    new byte[]{1, 2, 3, 4}
            );

            mockMvc.perform(multipart("/api/profile/avatar")
                            .file(file)
                            .principal(() -> "testuser"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("Только изображения: jpg, png, gif, webp"));
        }
    }

    // ================================================================
    // DELETE /api/profile/avatar — удаление аватара
    // ================================================================
    @Nested
    @DisplayName("DELETE /api/profile/avatar")
    class DeleteAvatar {

        @Test
        @DisplayName("deletes avatar successfully")
        void deleteAvatar_success() throws Exception {
            when(chatService.getAvatarUrl("testuser")).thenReturn("/api/uploads/avatar_old.jpg");

            mockMvc.perform(delete("/api/profile/avatar").principal(() -> "testuser"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.avatarUrl").value(""));

            verify(chatService).updateAvatarUrl("testuser", null);
        }

        @Test
        @DisplayName("deletes avatar when no existing avatar")
        void deleteAvatar_noExisting() throws Exception {
            when(chatService.getAvatarUrl("testuser")).thenReturn(null);

            mockMvc.perform(delete("/api/profile/avatar").principal(() -> "testuser"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.avatarUrl").value(""));

            verify(chatService).updateAvatarUrl("testuser", null);
        }
    }
}
