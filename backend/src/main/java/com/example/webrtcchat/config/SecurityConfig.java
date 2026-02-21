package com.example.webrtcchat.config;

import com.example.webrtcchat.service.JwtService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.OncePerRequestFilter;

import org.springframework.beans.factory.annotation.Value;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtService jwtService;
    private final List<String> corsOrigins;

    // Simple in-memory rate limiter for auth endpoints
    private final Map<String, long[]> rateLimitMap = new ConcurrentHashMap<>();
    private static final int MAX_AUTH_REQUESTS = 10; // per window
    private static final long RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

    public SecurityConfig(JwtService jwtService,
                          @Value("${cors.allowed-origins:http://localhost:*}") String origins) {
        this.jwtService = jwtService;
        this.corsOrigins = Arrays.asList(origins.split(","));
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/uploads/**").permitAll()
                .requestMatchers("/ws/**").permitAll()
                .requestMatchers("/actuator/health").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(rateLimitFilter(), UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwtAuthFilter(), UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(corsOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public OncePerRequestFilter rateLimitFilter() {
        return new OncePerRequestFilter() {
            @Override
            protected void doFilterInternal(HttpServletRequest request,
                                            HttpServletResponse response,
                                            FilterChain filterChain) throws ServletException, IOException {
                String path = request.getRequestURI();
                if (path.startsWith("/api/auth/")) {
                    String ip = getClientIp(request);
                    if (!isAllowed(ip)) {
                        response.setStatus(429);
                        response.setContentType("application/json");
                        response.getWriter().write("{\"error\":\"Слишком много запросов. Попробуйте позже.\"}");
                        return;
                    }
                }
                filterChain.doFilter(request, response);
            }
        };
    }

    private boolean isAllowed(String ip) {
        long now = System.currentTimeMillis();
        rateLimitMap.compute(ip, (key, window) -> {
            if (window == null || now - window[0] > RATE_LIMIT_WINDOW_MS) {
                return new long[]{now, 1};
            }
            window[1]++;
            return window;
        });
        long[] window = rateLimitMap.get(ip);
        // Periodic cleanup (every 100 checks)
        if (rateLimitMap.size() > 1000) {
            rateLimitMap.entrySet().removeIf(e -> now - e.getValue()[0] > RATE_LIMIT_WINDOW_MS);
        }
        return window != null && window[1] <= MAX_AUTH_REQUESTS;
    }

    private String getClientIp(HttpServletRequest request) {
        // Only trust X-Forwarded-For from local/docker reverse proxy
        String remoteAddr = request.getRemoteAddr();
        if (isTrustedProxy(remoteAddr)) {
            String xff = request.getHeader("X-Forwarded-For");
            if (xff != null && !xff.isBlank()) {
                return xff.split(",")[0].trim();
            }
        }
        return remoteAddr;
    }

    private boolean isTrustedProxy(String ip) {
        return ip != null && (ip.startsWith("127.") || ip.startsWith("10.")
                || ip.startsWith("172.") || ip.startsWith("192.168.")
                || "0:0:0:0:0:0:0:1".equals(ip));
    }

    @Bean
    public OncePerRequestFilter jwtAuthFilter() {
        return new OncePerRequestFilter() {
            @Override
            protected void doFilterInternal(HttpServletRequest request,
                                            HttpServletResponse response,
                                            FilterChain filterChain) throws ServletException, IOException {
                String authHeader = request.getHeader("Authorization");
                if (authHeader != null && authHeader.startsWith("Bearer ")) {
                    String token = authHeader.substring(7);
                    if (jwtService.isTokenValid(token)) {
                        String username = jwtService.extractUsername(token);
                        UsernamePasswordAuthenticationToken auth =
                            new UsernamePasswordAuthenticationToken(username, null, List.of());
                        SecurityContextHolder.getContext().setAuthentication(auth);
                    }
                }
                filterChain.doFilter(request, response);
            }
        };
    }
}
