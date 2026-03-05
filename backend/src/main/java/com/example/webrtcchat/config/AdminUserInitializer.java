package com.example.webrtcchat.config;

import com.example.webrtcchat.entity.UserEntity;
import com.example.webrtcchat.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
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

    @Bean
    public CommandLineRunner initAdminUser(UserRepository userRepository, PasswordEncoder passwordEncoder,
                                           @Value("${admin.password:}") String adminPassword) {
        return args -> {
            if (adminPassword == null || adminPassword.isBlank()) {
                log.warn("ADMIN_PASSWORD env var not set — skipping admin user init. Set it in production!");
                // Still ensure existing admin has ADMIN role
                userRepository.findByUsername(ADMIN_USERNAME).ifPresent(user -> {
                    if (!"ADMIN".equals(user.getRole())) {
                        user.setRole("ADMIN");
                        userRepository.save(user);
                        log.info("Admin user '{}' role set to ADMIN", ADMIN_USERNAME);
                    }
                });
                return;
            }
            if (!userRepository.existsByUsername(ADMIN_USERNAME)) {
                UserEntity admin = new UserEntity(
                        ADMIN_USERNAME,
                        passwordEncoder.encode(adminPassword),
                        LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
                );
                admin.setRole("ADMIN");
                userRepository.save(admin);
                log.info("Admin user '{}' created", ADMIN_USERNAME);
            } else {
                // Ensure existing admin user has ADMIN role and correct password
                userRepository.findByUsername(ADMIN_USERNAME).ifPresent(user -> {
                    boolean changed = false;
                    if (!"ADMIN".equals(user.getRole())) {
                        user.setRole("ADMIN");
                        changed = true;
                    }
                    if (!passwordEncoder.matches(adminPassword, user.getPassword())) {
                        user.setPassword(passwordEncoder.encode(adminPassword));
                        changed = true;
                    }
                    if (changed) {
                        userRepository.save(user);
                        log.info("Admin user '{}' updated (role + password)", ADMIN_USERNAME);
                    }
                });
            }
        };
    }
}
