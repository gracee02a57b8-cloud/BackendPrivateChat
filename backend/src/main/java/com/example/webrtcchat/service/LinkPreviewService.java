package com.example.webrtcchat.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.HttpURLConnection;
import java.net.URL;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Fetches Open Graph metadata (title, description, image) from a URL for link previews.
 */
@Service
public class LinkPreviewService {

    private static final Logger log = LoggerFactory.getLogger(LinkPreviewService.class);
    private static final Pattern URL_PATTERN = Pattern.compile("(https?://[\\w\\-._~:/?#\\[\\]@!$&'()*+,;=%]+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern OG_TITLE = Pattern.compile("<meta[^>]+property=[\"']og:title[\"'][^>]+content=[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE);
    private static final Pattern OG_DESC = Pattern.compile("<meta[^>]+property=[\"']og:description[\"'][^>]+content=[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE);
    private static final Pattern OG_IMAGE = Pattern.compile("<meta[^>]+property=[\"']og:image[\"'][^>]+content=[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE);
    private static final Pattern TITLE_TAG = Pattern.compile("<title[^>]*>([^<]+)</title>", Pattern.CASE_INSENSITIVE);

    // Simple in-memory cache
    private final Map<String, Map<String, String>> cache = new ConcurrentHashMap<>();

    /**
     * Extract first URL from text.
     */
    public String extractUrl(String text) {
        if (text == null) return null;
        Matcher matcher = URL_PATTERN.matcher(text);
        return matcher.find() ? matcher.group(1) : null;
    }

    /**
     * Fetch OG metadata for a URL. Returns map with title, description, image, url.
     */
    public Map<String, String> fetchPreview(String url) {
        if (url == null) return null;
        if (cache.containsKey(url)) return cache.get(url);

        try {
            HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("User-Agent", "BarsikChatBot/1.0");
            conn.setConnectTimeout(3000);
            conn.setReadTimeout(3000);
            conn.setInstanceFollowRedirects(true);

            if (conn.getResponseCode() != 200) return null;

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

        } catch (Exception e) {
            log.debug("Failed to fetch link preview for {}: {}", url, e.getMessage());
            return null;
        }
    }
}
