package com.example.webrtcchat.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.*;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Fetches Open Graph metadata (title, description, image) from a URL for link previews.
 * <p>
 * Security: blocks SSRF by validating URL scheme (http/https only),
 * resolving DNS and rejecting private/loopback/link-local IPs before connecting.
 */
@Service
public class LinkPreviewService {

    private static final Logger log = LoggerFactory.getLogger(LinkPreviewService.class);
    private static final Pattern URL_PATTERN = Pattern.compile("(https?://[\\w\\-._~:/?#\\[\\]@!$&'()*+,;=%]+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern OG_TITLE = Pattern.compile("<meta[^>]+property=[\"']og:title[\"'][^>]+content=[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE);
    private static final Pattern OG_DESC = Pattern.compile("<meta[^>]+property=[\"']og:description[\"'][^>]+content=[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE);
    private static final Pattern OG_IMAGE = Pattern.compile("<meta[^>]+property=[\"']og:image[\"'][^>]+content=[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE);
    private static final Pattern TITLE_TAG = Pattern.compile("<title[^>]*>([^<]+)</title>", Pattern.CASE_INSENSITIVE);

    /** Max cache entries to prevent unbounded memory growth. */
    static final int MAX_CACHE_SIZE = 1_000;

    // Bounded LRU cache — evicts oldest entries when full
    private final Map<String, Map<String, String>> cache =
            new ConcurrentHashMap<>() {
                @Override
                public Map<String, String> put(String key, Map<String, String> value) {
                    if (size() >= MAX_CACHE_SIZE) {
                        // Evict first (oldest) entry
                        var first = keySet().iterator().next();
                        remove(first);
                    }
                    return super.put(key, value);
                }
            };

    /**
     * Extract first URL from text.
     */
    public String extractUrl(String text) {
        if (text == null) return null;
        Matcher matcher = URL_PATTERN.matcher(text);
        return matcher.find() ? matcher.group(1) : null;
    }

    /**
     * Check if URL is safe to fetch (not targeting internal/private networks).
     * Validates: scheme is http/https, resolved IP is not private/loopback/link-local.
     *
     * @return true if safe, false if blocked
     */
    boolean isSafeUrl(String url) {
        try {
            URI uri = new URI(url);
            String scheme = uri.getScheme();
            if (scheme == null || (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https"))) {
                log.warn("SSRF blocked: non-http(s) scheme in URL: {}", url);
                return false;
            }

            String host = uri.getHost();
            if (host == null || host.isBlank()) {
                log.warn("SSRF blocked: no host in URL: {}", url);
                return false;
            }

            // Resolve DNS and check every resolved IP
            InetAddress[] addresses = InetAddress.getAllByName(host);
            for (InetAddress addr : addresses) {
                if (isPrivateOrReserved(addr)) {
                    log.warn("SSRF blocked: {} resolves to private/reserved IP {}", url, addr.getHostAddress());
                    return false;
                }
            }

            return true;
        } catch (URISyntaxException e) {
            log.warn("SSRF blocked: malformed URL: {}", url);
            return false;
        } catch (UnknownHostException e) {
            log.debug("SSRF blocked: cannot resolve host for URL: {}", url);
            return false;
        }
    }

    /**
     * Returns true if the address is loopback, link-local, site-local (private),
     * multicast, or any-local (0.0.0.0 / ::).
     */
    static boolean isPrivateOrReserved(InetAddress addr) {
        return addr.isLoopbackAddress()      // 127.x.x.x, ::1
                || addr.isSiteLocalAddress() // 10.x, 172.16-31.x, 192.168.x
                || addr.isLinkLocalAddress() // 169.254.x.x, fe80::
                || addr.isMulticastAddress() // 224.x+
                || addr.isAnyLocalAddress(); // 0.0.0.0, ::
    }

    /**
     * Fetch OG metadata for a URL. Returns map with title, description, image, url.
     * Blocks SSRF attempts targeting private/internal IPs.
     */
    public Map<String, String> fetchPreview(String url) {
        if (url == null) return null;
        if (cache.containsKey(url)) return cache.get(url);

        // ── SSRF protection ──
        if (!isSafeUrl(url)) return null;

        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URI(url).toURL().openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("User-Agent", "BarsikChatBot/1.0");
            conn.setConnectTimeout(3000);
            conn.setReadTimeout(3000);
            // Disable automatic redirects — a redirect could point to an internal IP
            conn.setInstanceFollowRedirects(false);

            int status = conn.getResponseCode();

            // Handle redirects manually with SSRF check
            if (status == HttpURLConnection.HTTP_MOVED_PERM
                    || status == HttpURLConnection.HTTP_MOVED_TEMP
                    || status == 307 || status == 308) {
                String location = conn.getHeaderField("Location");
                conn.disconnect();
                if (location == null || !isSafeUrl(location)) {
                    log.warn("SSRF blocked: redirect to unsafe location: {}", location);
                    return null;
                }
                // Fetch the redirect target (single hop only)
                return fetchPreviewDirect(location);
            }

            if (status != 200) return null;

            return parseHtml(url, conn);

        } catch (Exception e) {
            log.debug("Failed to fetch link preview for {}: {}", url, e.getMessage());
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    /** Fetch a URL directly (used for single-hop redirect, no further redirects allowed). */
    private Map<String, String> fetchPreviewDirect(String url) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URI(url).toURL().openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("User-Agent", "BarsikChatBot/1.0");
            conn.setConnectTimeout(3000);
            conn.setReadTimeout(3000);
            conn.setInstanceFollowRedirects(false);

            if (conn.getResponseCode() != 200) return null;
            return parseHtml(url, conn);

        } catch (Exception e) {
            log.debug("Failed to fetch redirect target {}: {}", url, e.getMessage());
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    /** Parse HTML from connection, extract OG tags. */
    private Map<String, String> parseHtml(String url, HttpURLConnection conn) throws Exception {
        String contentType = conn.getContentType();
        if (contentType != null && !contentType.contains("text/html")) return null;

        byte[] bytes = conn.getInputStream().readNBytes(64_000); // Read first 64KB
        String html = new String(bytes, "UTF-8");

        Map<String, String> result = new LinkedHashMap<>();
        result.put("url", url);

        Matcher m;
        m = OG_TITLE.matcher(html);
        if (m.find()) result.put("title", m.group(1));
        else {
            m = TITLE_TAG.matcher(html);
            if (m.find()) result.put("title", m.group(1));
        }

        m = OG_DESC.matcher(html);
        if (m.find()) result.put("description", m.group(1));

        m = OG_IMAGE.matcher(html);
        if (m.find()) result.put("image", m.group(1));

        if (result.size() <= 1) return null; // Only URL, no metadata

        cache.put(url, result);
        return result;
    }
}
