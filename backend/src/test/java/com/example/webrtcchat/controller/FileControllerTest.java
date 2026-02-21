package com.example.webrtcchat.controller;

import com.example.webrtcchat.service.JwtService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(FileController.class)
@AutoConfigureMockMvc(addFilters = false)
class FileControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private JwtService jwtService;

    // === uploadImage ===

    @Test
    @DisplayName("POST /api/upload - rejects non-image extension")
    void uploadImage_rejectsNonImage() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "test.txt", "text/plain", "hello".getBytes());

        mockMvc.perform(multipart("/api/upload").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Only image files allowed"));
    }

    @Test
    @DisplayName("POST /api/upload - rejects empty file")
    void uploadImage_rejectsEmpty() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "test.png", "image/png", new byte[0]);

        mockMvc.perform(multipart("/api/upload").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("File is empty"));
    }

    @Test
    @DisplayName("POST /api/upload - rejects oversized image (>20MB)")
    void uploadImage_rejectsOversized() throws Exception {
        byte[] bigData = new byte[21 * 1024 * 1024]; // 21MB
        MockMultipartFile file = new MockMultipartFile(
                "file", "big.png", "image/png", bigData);

        mockMvc.perform(multipart("/api/upload").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Image too large (max 20MB)"));
    }

    // === uploadAnyFile ===

    @Test
    @DisplayName("POST /api/upload/file - blocks .exe extension")
    void uploadFile_blocksExe() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "malware.exe", "application/octet-stream", "MZ".getBytes());

        mockMvc.perform(multipart("/api/upload/file").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("File type not allowed: .exe"));
    }

    @Test
    @DisplayName("POST /api/upload/file - blocks .bat extension")
    void uploadFile_blocksBat() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "script.bat", "text/plain", "echo hacked".getBytes());

        mockMvc.perform(multipart("/api/upload/file").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("File type not allowed: .bat"));
    }

    @Test
    @DisplayName("POST /api/upload/file - blocks .sh extension")
    void uploadFile_blocksSh() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "script.sh", "text/plain", "#!/bin/bash".getBytes());

        mockMvc.perform(multipart("/api/upload/file").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("File type not allowed: .sh"));
    }

    @Test
    @DisplayName("POST /api/upload/file - blocks .jsp extension")
    void uploadFile_blocksJsp() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "shell.jsp", "text/plain", "<%@page%>".getBytes());

        mockMvc.perform(multipart("/api/upload/file").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("File type not allowed: .jsp"));
    }

    @Test
    @DisplayName("POST /api/upload/file - allows safe extensions (.pdf)")
    void uploadFile_allowsPdf() throws Exception {
        // PDF magic bytes
        byte[] pdfContent = "%PDF-1.4 test content".getBytes();
        MockMultipartFile file = new MockMultipartFile(
                "file", "document.pdf", "application/pdf", pdfContent);

        mockMvc.perform(multipart("/api/upload/file").file(file))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").exists())
                .andExpect(jsonPath("$.filename").exists());
    }

    @Test
    @DisplayName("POST /api/upload/file - allows safe extensions (.docx)")
    void uploadFile_allowsDocx() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "report.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "PK\003\004 content".getBytes());

        mockMvc.perform(multipart("/api/upload/file").file(file))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("POST /api/upload/file - rejects empty file")
    void uploadFile_rejectsEmpty() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "empty.pdf", "application/pdf", new byte[0]);

        mockMvc.perform(multipart("/api/upload/file").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("File is empty"));
    }

    // === getFile ===

    @Test
    @DisplayName("GET /api/uploads/.. - path traversal blocked")
    void getFile_pathTraversalBlocked() throws Exception {
        // Servlet normalizes the path, so ../../ gets resolved.
        // Either 400 (bad request) or 404 (not found) is acceptable — file must NOT be served.
        mockMvc.perform(get("/api/uploads/..%2F..%2F..%2Fetc%2Fpasswd"))
                .andExpect(result -> {
                    int status = result.getResponse().getStatus();
                    assertTrue(status == 400 || status == 404,
                            "Expected 400 or 404 but got " + status);
                });
    }

    @Test
    @DisplayName("GET /api/uploads/nonexistent.png - returns 404")
    void getFile_notFound() throws Exception {
        mockMvc.perform(get("/api/uploads/nonexistent-file-12345.png"))
                .andExpect(status().isNotFound());
    }
}
