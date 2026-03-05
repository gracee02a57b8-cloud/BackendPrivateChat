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
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.OncePerRequestFilter;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);

    private final JwtService jwtService;
    private final List<String> corsOrigins;

    // Token-bucket rate limiter for auth endpoints (P1-6: fixed race conditions + bounded cleanup)
    private final Map<String, long[]> rateLimitMap = new ConcurrentHashMap<>();
    private final int maxAuthRequests;
    private final long rateLimitWindowMs;
    private static final int MAX_RATE_LIMIT_ENTRIES = 10_000; // hard cap to prevent OOM
    private volatile long lastCleanup = System.currentTimeMillis();

    public SecurityConfig(JwtService jwtService,
                          @Value("${cors.allowed-origins:http://localhost:*}") String origins,
                          @Value("${rate-limit.max-requests:10}") int maxAuthRequests,
                          @Value("${rate-limit.window-ms:60000}") long rateLimitWindowMs) {
        this.jwtService = jwtService;
        this.maxAuthRequests = maxAuthRequests;
        this.rateLimitWindowMs = rateLimitWindowMs;
        this.corsOrigins = Arrays.stream(origins.split(","))
                .map(String::trim)
                .filter(o -> !o.isEmpty())
                .filter(o -> {
                    if ("*".equals(o)) {
                        log.warn("CORS origin wildcard '*' rejected — configure explicit origins via CORS_ORIGINS env var");
                        return false;
                    }
                    return true;
                })
                .toList();

        log.info("REST CORS allowed origin patterns: {}", this.corsOrigins);
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
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/conference/*/info").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
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

        // Periodic cleanup — remove expired windows (every 60s, not on every call)
        if (now - lastCleanup > rateLimitWindowMs) {
            lastCleanup = now;
            rateLimitMap.entrySet().removeIf(e -> now - e.getValue()[0] > rateLimitWindowMs);
        }

        // Hard cap: if map is too large (DDoS with rotating IPs), reject new IPs
        if (rateLimitMap.size() >= MAX_RATE_LIMIT_ENTRIES && !rateLimitMap.containsKey(ip)) {
            return false;
        }

        // Atomic compute — returns the updated window directly (no separate get())
        long[] window = rateLimitMap.compute(ip, (key, val) -> {
            if (val == null || now - val[0] > rateLimitWindowMs) {
                return new long[]{now, 1};
            }
            val[1]++;
            return val;
        });

        return window[1] <= maxAuthRequests;
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
        if (ip == null) return false;
        if (ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.")
                || "0:0:0:0:0:0:0:1".equals(ip)) {
            return true;
        }
        // RFC 1918: only 172.16.0.0 – 172.31.255.255 are private
        if (ip.startsWith("172.")) {
            try {
                int second = Integer.parseInt(ip.split("\\.")[1]);
                return second >= 16 && second <= 31;
            } catch (NumberFormatException | ArrayIndexOutOfBoundsException e) {
                return false;
            }
        }
        return false;
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
                        String role = jwtService.extractRole(token);
                        var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + role));
                        UsernamePasswordAuthenticationToken auth =
                            new UsernamePasswordAuthenticationToken(username, null, authorities);
                        SecurityContextHolder.getContext().setAuthentication(auth);
                    }
                }
                filterChain.doFilter(request, response);
            }
        };
    }
}
