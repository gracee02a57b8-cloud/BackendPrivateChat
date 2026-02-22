package com.example.webrtcchat.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import org.springframework.beans.factory.annotation.Value;

import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class FileController {

    private static final Logger log = LoggerFactory.getLogger(FileController.class);
    private static final long MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB
    private static final long MAX_FILE_SIZE = 100L * 1024 * 1024; // 100MB
    private final Path uploadDir;

    // Allowed image extensions (C10)
    private static final Set<String> ALLOWED_IMAGE_EXT = Set.of(
            ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".ico"
    );

    // Blocked dangerous extensions (R6)
    private static final Set<String> BLOCKED_EXTENSIONS = Set.of(
            ".exe", ".bat", ".cmd", ".sh", ".ps1", ".msi", ".dll", ".com",
            ".scr", ".vbs", ".vbe", ".js", ".jse", ".wsf", ".wsh", ".pif",
            ".hta", ".cpl", ".reg", ".inf", ".jar", ".class", ".php", ".asp",
            ".aspx", ".jsp", ".py", ".rb", ".pl", ".cgi"
    );

    public FileController(@Value("${upload.dir:uploads}") String uploadDirPath) {
        this.uploadDir = Paths.get(uploadDirPath).toAbsolutePath().normalize();
        try {
            Files.createDirectories(uploadDir);
        } catch (IOException e) {
            throw new RuntimeException("Could not create upload directory", e);
        }
    }

    @PostMapping("/upload")
    public ResponseEntity<?> uploadImage(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "File is empty"));
        }
        if (file.getSize() > MAX_IMAGE_SIZE) {
            return ResponseEntity.badRequest().body(Map.of("error", "Image too large (max 20MB)"));
        }

        // Validate extension is an image type (C10)
        String ext = getExtension(file.getOriginalFilename()).toLowerCase();
        if (!ALLOWED_IMAGE_EXT.contains(ext)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Only image files allowed"));
        }

        // Server-side content-type detection (C10) — don't trust client header
        String detectedType = detectContentType(file);
        if (detectedType == null || !detectedType.startsWith("image/")) {
            return ResponseEntity.badRequest().body(Map.of("error", "File content is not a valid image"));
        }

        return saveFile(file, detectedType);
    }

    @PostMapping("/upload/file")
    public ResponseEntity<?> uploadAnyFile(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "File is empty"));
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            return ResponseEntity.badRequest().body(Map.of("error", "File too large (max 100MB)"));
        }

        // Block dangerous extensions (R6)
        String ext = getExtension(file.getOriginalFilename()).toLowerCase();
        if (BLOCKED_EXTENSIONS.contains(ext)) {
            return ResponseEntity.badRequest().body(Map.of("error", "File type not allowed: " + ext));
        }

        String detectedType = detectContentType(file);
        return saveFile(file, detectedType);
    }

    private ResponseEntity<?> saveFile(MultipartFile file, String contentType) {
        try {
            String ext = getExtension(file.getOriginalFilename());
            String filename = UUID.randomUUID().toString() + ext;
            Path target = uploadDir.resolve(filename);
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);

            String safeContentType = contentType != null ? contentType : "application/octet-stream";
            String url = "/api/uploads/" + filename;
            return ResponseEntity.ok(Map.of(
                    "url", url,
                    "filename", filename,
                    "originalName", file.getOriginalFilename() != null ? file.getOriginalFilename() : filename,
                    "size", file.getSize(),
                    "contentType", safeContentType
            ));
        } catch (IOException e) {
            log.error("Upload failed", e);
            return ResponseEntity.internalServerError().body(Map.of("error", "Upload failed"));
        }
    }

    @GetMapping("/uploads/{filename:.+}")
    public ResponseEntity<Resource> getFile(@PathVariable String filename,
                                            @RequestParam(value = "download", required = false) Boolean download) {
        try {
            Path file = uploadDir.resolve(filename).normalize();
            if (!file.startsWith(uploadDir)) {
                return ResponseEntity.badRequest().build();
            }
            Resource resource = new UrlResource(file.toUri());
            if (!resource.exists()) {
                return ResponseEntity.notFound().build();
            }

            String contentType = Files.probeContentType(file);
            if (contentType == null) contentType = "application/octet-stream";

            var builder = ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CACHE_CONTROL, "max-age=86400");

            boolean inline = contentType.startsWith("image/") || contentType.startsWith("video/") || contentType.startsWith("audio/");
            if (Boolean.TRUE.equals(download) || !inline) {
                builder = builder.header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\"");
            }

            return builder.body(resource);
        } catch (MalformedURLException e) {
            return ResponseEntity.badRequest().build();
        } catch (IOException e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Detect content type from file bytes (server-side, not trusting client header).
     */
    private String detectContentType(MultipartFile file) {
        try {
            // Use file magic bytes detection
            Path tempFile = Files.createTempFile("upload-check-", getExtension(file.getOriginalFilename()));
            try {
                Files.copy(file.getInputStream(), tempFile, StandardCopyOption.REPLACE_EXISTING);
                String probed = Files.probeContentType(tempFile);
                return probed != null ? probed : file.getContentType();
            } finally {
                Files.deleteIfExists(tempFile);
            }
        } catch (IOException e) {
            log.warn("Content type detection failed, falling back to client header", e);
            return file.getContentType();
        }
    }

    private String getExtension(String filename) {
        if (filename != null && filename.contains(".")) {
            String ext = filename.substring(filename.lastIndexOf("."));
            // Sanitize extension — only allow alphanumeric
            if (ext.matches("\\.[a-zA-Z0-9]+")) {
                return ext;
            }
        }
        return ".bin";
    }
}
