package com.example.webrtcchat.config;

import com.example.webrtcchat.entity.UserEntity;
import com.example.webrtcchat.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Configuration
public class AdminUserInitializer {

    private static final Logger log = LoggerFactory.getLogger(AdminUserInitializer.class);
    private static final String ADMIN_USERNAME = "admin";
    private static final String ADMIN_PASSWORD = "BarsikAdmin2026!";

    @Bean
    public CommandLineRunner initAdminUser(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            if (!userRepository.existsByUsername(ADMIN_USERNAME)) {
                UserEntity admin = new UserEntity(
                        ADMIN_USERNAME,
                        passwordEncoder.encode(ADMIN_PASSWORD),
                        LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
                );
                admin.setRole("ADMIN");
                userRepository.save(admin);
                log.info("Admin user '{}' created", ADMIN_USERNAME);
            } else {
                // Ensure existing admin user has ADMIN role
                userRepository.findByUsername(ADMIN_USERNAME).ifPresent(user -> {
                    if (!"ADMIN".equals(user.getRole())) {
                        user.setRole("ADMIN");
                        userRepository.save(user);
                        log.info("Admin user '{}' role updated to ADMIN", ADMIN_USERNAME);
                    }
                });
            }
        };
    }
}
