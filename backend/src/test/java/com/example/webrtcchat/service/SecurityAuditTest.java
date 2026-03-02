package com.example.webrtcchat.service;

import com.example.webrtcchat.config.SecurityConfig;
import com.example.webrtcchat.config.WebSocketConfig;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.lang.reflect.Field;
import java.net.InetAddress;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests verifying security audit fixes:
 *   P0-2 — SSRF protection in LinkPreviewService
 *   P0-3 — WebSocket / CORS origin wildcard rejection
 */
class SecurityAuditTest {

    // ═══════════════════════════════════════════════════════
    //  P0-2 — SSRF protection in LinkPreviewService
    // ═══════════════════════════════════════════════════════

    @Nested
    @DisplayName("P0-2 — SSRF protection")
    class SsrfProtectionTest {

        private final LinkPreviewService service = new LinkPreviewService();

        // ── Scheme validation ──

        @Test
        @DisplayName("SSRF: blocks file:// scheme")
        void blocks_fileScheme() {
            assertFalse(service.isSafeUrl("file:///etc/passwd"));
        }

        @Test
        @DisplayName("SSRF: blocks ftp:// scheme")
        void blocks_ftpScheme() {
            assertFalse(service.isSafeUrl("ftp://internal-server/data"));
        }

        @Test
        @DisplayName("SSRF: blocks gopher:// scheme")
        void blocks_gopherScheme() {
            assertFalse(service.isSafeUrl("gopher://evil.com/payload"));
        }

        @Test
        @DisplayName("SSRF: blocks URL without scheme")
        void blocks_noScheme() {
            assertFalse(service.isSafeUrl("//evil.com/path"));
        }

        @Test
        @DisplayName("SSRF: allows https:// scheme")
        void allows_httpsScheme() {
            // Will pass scheme check but may fail DNS — that's OK,
            // we only test the scheme validation logic here.
            // Use a real public domain to verify full path.
            assertTrue(service.isSafeUrl("https://example.com"));
        }

        @Test
        @DisplayName("SSRF: allows http:// scheme")
        void allows_httpScheme() {
            assertTrue(service.isSafeUrl("http://example.com"));
        }

        // ── Private/Reserved IP blocking ──

        @ParameterizedTest(name = "SSRF: blocks private IP {0}")
        @ValueSource(strings = {
                "http://127.0.0.1",
                "http://127.0.0.1:8080/admin",
                "http://localhost",
                "http://localhost:9001/api/admin",
                "http://10.0.0.1",
                "http://10.255.255.255/secret",
                "http://172.16.0.1",
                "http://172.31.255.255",
                "http://192.168.0.1",
                "http://192.168.1.100:8080",
                "http://169.254.169.254/latest/meta-data/", // AWS metadata
                "http://[::1]",          // IPv6 loopback
                "http://0.0.0.0",        // any-local
        })
        void blocks_privateIps(String url) {
            assertFalse(service.isSafeUrl(url),
                    "Should block private/reserved IP: " + url);
        }

        // ── isPrivateOrReserved unit tests ──

        @Test
        @DisplayName("isPrivateOrReserved: loopback 127.0.0.1")
        void loopback_isPrivate() throws Exception {
            assertTrue(LinkPreviewService.isPrivateOrReserved(
                    InetAddress.getByName("127.0.0.1")));
        }

        @Test
        @DisplayName("isPrivateOrReserved: site-local 10.0.0.1")
        void siteLocal10_isPrivate() throws Exception {
            assertTrue(LinkPreviewService.isPrivateOrReserved(
                    InetAddress.getByName("10.0.0.1")));
        }

        @Test
        @DisplayName("isPrivateOrReserved: site-local 192.168.1.1")
        void siteLocal192_isPrivate() throws Exception {
            assertTrue(LinkPreviewService.isPrivateOrReserved(
                    InetAddress.getByName("192.168.1.1")));
        }

        @Test
        @DisplayName("isPrivateOrReserved: link-local 169.254.169.254")
        void linkLocal_isPrivate() throws Exception {
            assertTrue(LinkPreviewService.isPrivateOrReserved(
                    InetAddress.getByName("169.254.169.254")));
        }

        @Test
        @DisplayName("isPrivateOrReserved: any-local 0.0.0.0")
        void anyLocal_isPrivate() throws Exception {
            assertTrue(LinkPreviewService.isPrivateOrReserved(
                    InetAddress.getByName("0.0.0.0")));
        }

        @Test
        @DisplayName("isPrivateOrReserved: public IP 8.8.8.8 is NOT private")
        void publicIp_isNotPrivate() throws Exception {
            assertFalse(LinkPreviewService.isPrivateOrReserved(
                    InetAddress.getByName("8.8.8.8")));
        }

        @Test
        @DisplayName("isPrivateOrReserved: public IP 93.184.216.34 is NOT private")
        void publicIp2_isNotPrivate() throws Exception {
            assertFalse(LinkPreviewService.isPrivateOrReserved(
                    InetAddress.getByName("93.184.216.34")));
        }

        // ── fetchPreview returns null for SSRF attempts ──

        @Test
        @DisplayName("fetchPreview returns null for private IP URL")
        void fetchPreview_nullForPrivateIp() {
            assertNull(service.fetchPreview("http://127.0.0.1:8080/admin"));
        }

        @Test
        @DisplayName("fetchPreview returns null for file:// URL")
        void fetchPreview_nullForFileScheme() {
            assertNull(service.fetchPreview("file:///etc/passwd"));
        }

        @Test
        @DisplayName("fetchPreview returns null for null URL")
        void fetchPreview_nullForNull() {
            assertNull(service.fetchPreview(null));
        }

        // ── Malformed URL handling ──

        @Test
        @DisplayName("SSRF: blocks malformed URL")
        void blocks_malformedUrl() {
            assertFalse(service.isSafeUrl("ht tp://evil .com"));
        }

        @Test
        @DisplayName("SSRF: blocks URL with no host")
        void blocks_noHost() {
            assertFalse(service.isSafeUrl("http:///path/only"));
        }

        // ── Bounded cache ──

        @Test
        @DisplayName("Cache has MAX_CACHE_SIZE = 1000")
        void cacheHasBound() {
            assertEquals(1_000, LinkPreviewService.MAX_CACHE_SIZE,
                    "Cache limit should be 1000 entries");
        }
    }

    // ═══════════════════════════════════════════════════════
    //  P0-3 — WebSocket origin wildcard rejection
    // ═══════════════════════════════════════════════════════

    @Nested
    @DisplayName("P0-3 — WebSocket origin validation")
    class WebSocketOriginTest {

        @Test
        @DisplayName("WebSocketConfig rejects standalone '*' origin")
        void rejects_wildcardStar() throws Exception {
            WebSocketConfig config = new WebSocketConfig(null, "*");
            String[] origins = getAllowedOrigins(config);
            for (String o : origins) {
                assertNotEquals("*", o, "Standalone '*' must be filtered out");
            }
            assertEquals(0, origins.length,
                    "Only '*' was provided — no origins should remain");
        }

        @Test
        @DisplayName("WebSocketConfig keeps valid origin patterns")
        void keeps_validOrigins() throws Exception {
            WebSocketConfig config = new WebSocketConfig(null,
                    "https://barsikchat.duckdns.org,http://localhost:*");
            String[] origins = getAllowedOrigins(config);
            assertEquals(2, origins.length);
            assertTrue(Arrays.asList(origins).contains("https://barsikchat.duckdns.org"));
            assertTrue(Arrays.asList(origins).contains("http://localhost:*"));
        }

        @Test
        @DisplayName("WebSocketConfig filters '*' but keeps valid origins")
        void filters_wildcardAmongValid() throws Exception {
            WebSocketConfig config = new WebSocketConfig(null,
                    "https://barsikchat.duckdns.org,*,http://localhost:*");
            String[] origins = getAllowedOrigins(config);
            assertEquals(2, origins.length);
            assertFalse(Arrays.asList(origins).contains("*"));
        }

        @Test
        @DisplayName("WebSocketConfig trims whitespace from origins")
        void trims_whitespace() throws Exception {
            WebSocketConfig config = new WebSocketConfig(null,
                    " https://barsikchat.duckdns.org , http://localhost:* ");
            String[] origins = getAllowedOrigins(config);
            assertEquals(2, origins.length);
            assertTrue(Arrays.asList(origins).contains("https://barsikchat.duckdns.org"));
            assertTrue(Arrays.asList(origins).contains("http://localhost:*"));
        }

        @Test
        @DisplayName("WebSocketConfig filters empty strings")
        void filters_emptyStrings() throws Exception {
            WebSocketConfig config = new WebSocketConfig(null,
                    "https://barsikchat.duckdns.org,,http://localhost:*");
            String[] origins = getAllowedOrigins(config);
            assertEquals(2, origins.length);
        }

        /** Reflectively read the allowedOrigins field from WebSocketConfig. */
        private String[] getAllowedOrigins(WebSocketConfig config) throws Exception {
            Field field = WebSocketConfig.class.getDeclaredField("allowedOrigins");
            field.setAccessible(true);
            return (String[]) field.get(config);
        }
    }

    // ═══════════════════════════════════════════════════════
    //  P0-3 — SecurityConfig CORS origin wildcard rejection
    // ═══════════════════════════════════════════════════════

    @Nested
    @DisplayName("P0-3 — SecurityConfig CORS origin validation")
    class SecurityConfigOriginTest {

        @Test
        @DisplayName("SecurityConfig rejects standalone '*' CORS origin")
        @SuppressWarnings("unchecked")
        void rejects_wildcardStar() throws Exception {
            SecurityConfig config = new SecurityConfig(null, "*");
            List<String> origins = getCorsOrigins(config);
            assertFalse(origins.contains("*"),
                    "Standalone '*' must be filtered out of CORS origins");
            assertEquals(0, origins.size());
        }

        @Test
        @DisplayName("SecurityConfig keeps valid CORS origins")
        @SuppressWarnings("unchecked")
        void keeps_validOrigins() throws Exception {
            SecurityConfig config = new SecurityConfig(null,
                    "https://barsikchat.duckdns.org,http://localhost:*");
            List<String> origins = getCorsOrigins(config);
            assertEquals(2, origins.size());
            assertTrue(origins.contains("https://barsikchat.duckdns.org"));
        }

        @Test
        @DisplayName("SecurityConfig filters '*' but keeps valid origins")
        @SuppressWarnings("unchecked")
        void filters_wildcardAmongValid() throws Exception {
            SecurityConfig config = new SecurityConfig(null,
                    "https://barsikchat.duckdns.org,*");
            List<String> origins = getCorsOrigins(config);
            assertEquals(1, origins.size());
            assertEquals("https://barsikchat.duckdns.org", origins.get(0));
        }

        /** Reflectively read the corsOrigins field from SecurityConfig. */
        @SuppressWarnings("unchecked")
        private List<String> getCorsOrigins(SecurityConfig config) throws Exception {
            Field field = SecurityConfig.class.getDeclaredField("corsOrigins");
            field.setAccessible(true);
            return (List<String>) field.get(config);
        }
    }
}
