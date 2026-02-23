package com.example.webrtcchat.service;

import com.example.webrtcchat.entity.PushSubscriptionEntity;
import com.example.webrtcchat.repository.PushSubscriptionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigInteger;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.*;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.CompletableFuture;

/**
 * WebPushService — implements RFC 8291 (Web Push Message Encryption)
 * with VAPID (RFC 8292) authentication. Pure Java 21 implementation,
 * no external crypto libraries needed.
 */
@Service
public class WebPushService {

    private static final Logger log = LoggerFactory.getLogger(WebPushService.class);
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final ObjectMapper mapper = new ObjectMapper();

    private final PushSubscriptionRepository repo;

    @Value("${vapid.public-key:}")
    private String vapidPublicKeyBase64;

    @Value("${vapid.private-key:}")
    private String vapidPrivateKeyBase64;

    @Value("${vapid.subject:mailto:admin@barsik.chat}")
    private String vapidSubject;

    private ECPrivateKey vapidPrivateKey;
    private ECPublicKey vapidPublicKey;
    private byte[] vapidPublicKeyBytes; // 65-byte uncompressed point
    private ECParameterSpec ecSpec;
    private HttpClient httpClient;

    public WebPushService(PushSubscriptionRepository repo) {
        this.repo = repo;
    }

    @PostConstruct
    void init() {
        try {
            // Load EC parameters for P-256
            AlgorithmParameters params = AlgorithmParameters.getInstance("EC");
            params.init(new ECGenParameterSpec("secp256r1"));
            ecSpec = params.getParameterSpec(ECParameterSpec.class);

            if (vapidPublicKeyBase64.isBlank() || vapidPrivateKeyBase64.isBlank()) {
                log.warn("[WebPush] VAPID keys not configured — push disabled. " +
                         "Generate with: node -e \"const e=require('crypto').createECDH('prime256v1');e.generateKeys();" +
                         "console.log(e.getPublicKey().toString('base64url'));console.log(e.getPrivateKey().toString('base64url'));\"");
                return;
            }

            // Decode private key (32-byte raw D value, base64url)
            byte[] privBytes = Base64.getUrlDecoder().decode(vapidPrivateKeyBase64);
            ECPrivateKeySpec privSpec = new ECPrivateKeySpec(new BigInteger(1, privBytes), ecSpec);
            vapidPrivateKey = (ECPrivateKey) KeyFactory.getInstance("EC").generatePrivate(privSpec);

            // Decode public key (65-byte uncompressed point, base64url)
            vapidPublicKeyBytes = Base64.getUrlDecoder().decode(vapidPublicKeyBase64);
            vapidPublicKey = decodePublicKey(vapidPublicKeyBytes);

            httpClient = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(10))
                    .build();

            log.info("[WebPush] Initialized with VAPID public key: {}", vapidPublicKeyBase64);
        } catch (Exception e) {
            log.error("[WebPush] Failed to initialize: {}", e.getMessage(), e);
        }
    }

    public boolean isEnabled() {
        return vapidPrivateKey != null && httpClient != null;
    }

    public String getVapidPublicKey() {
        return vapidPublicKeyBase64;
    }

    // ════════════════════════ Subscription management ════════════════════════

    @Transactional
    public void subscribe(String username, String endpoint, String p256dh, String auth) {
        Optional<PushSubscriptionEntity> existing = repo.findByEndpoint(endpoint);
        if (existing.isPresent()) {
            // Update existing subscription (e.g., user re-logged)
            PushSubscriptionEntity sub = existing.get();
            sub.setUsername(username);
            sub.setP256dh(p256dh);
            sub.setAuthKey(auth);
            repo.save(sub);
            log.info("[WebPush] Updated subscription for user '{}'", username);
        } else {
            PushSubscriptionEntity sub = new PushSubscriptionEntity(
                    UUID.randomUUID().toString(), username, endpoint,
                    p256dh, auth, now()
            );
            repo.save(sub);
            log.info("[WebPush] New subscription for user '{}'", username);
        }
    }

    @Transactional
    public void unsubscribe(String endpoint) {
        repo.findByEndpoint(endpoint).ifPresent(sub -> {
            repo.delete(sub);
            log.info("[WebPush] Unsubscribed: {}", sub.getUsername());
        });
    }

    // ════════════════════════ Push sending ════════════════════════

    /**
     * Send push notification to a specific user (all their devices).
     * Runs asynchronously to not block the caller.
     */
    public void sendPushToUserAsync(String username, String title, String body,
                                     String type, String roomId) {
        if (!isEnabled()) return;
        CompletableFuture.runAsync(() -> sendPushToUser(username, title, body, type, roomId));
    }

    /**
     * Send push notification to ALL subscribed users (except excludeUser).
     * Used for news notifications.
     */
    public void sendPushToAllAsync(String title, String body, String type,
                                    String roomId, String excludeUser) {
        if (!isEnabled()) return;
        CompletableFuture.runAsync(() -> {
            List<PushSubscriptionEntity> subs = repo.findAll();
            for (PushSubscriptionEntity sub : subs) {
                if (sub.getUsername().equals(excludeUser)) continue;
                sendPushToSubscription(sub, title, body, type, roomId);
            }
        });
    }

    private void sendPushToUser(String username, String title, String body,
                                 String type, String roomId) {
        List<PushSubscriptionEntity> subs = repo.findByUsername(username);
        for (PushSubscriptionEntity sub : subs) {
            sendPushToSubscription(sub, title, body, type, roomId);
        }
    }

    @Transactional
    protected void sendPushToSubscription(PushSubscriptionEntity sub, String title,
                                           String body, String type, String roomId) {
        try {
            // Build JSON payload matching what push-sw.js expects
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("title", title);
            payload.put("body", body != null ? (body.length() > 200 ? body.substring(0, 200) + "…" : body) : "");
            payload.put("type", type != null ? type : "message");
            if (roomId != null) payload.put("roomId", roomId);
            payload.put("tag", "barsik-" + (type != null ? type : "push"));
            payload.put("url", "/");

            String jsonPayload = mapper.writeValueAsString(payload);

            // Encrypt (RFC 8291)
            byte[] encrypted = encryptPayload(jsonPayload, sub.getP256dh(), sub.getAuthKey());

            // VAPID authorization
            String vapidToken = createVapidJwt(sub.getEndpoint());
            String publicKeyB64 = Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(vapidPublicKeyBytes);

            // Send HTTP POST
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(sub.getEndpoint()))
                    .header("Content-Type", "application/octet-stream")
                    .header("Content-Encoding", "aes128gcm")
                    .header("TTL", "86400")
                    .header("Urgency", "high")
                    .header("Authorization", "vapid t=" + vapidToken + ",k=" + publicKeyB64)
                    .POST(HttpRequest.BodyPublishers.ofByteArray(encrypted))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 201) {
                log.debug("[WebPush] Sent to {} ({})", sub.getUsername(), type);
            } else if (response.statusCode() == 410 || response.statusCode() == 404) {
                // Subscription expired or invalid — clean up
                log.info("[WebPush] Removing expired subscription for '{}'", sub.getUsername());
                repo.delete(sub);
            } else if (response.statusCode() == 429) {
                log.warn("[WebPush] Rate limited for '{}': {}", sub.getUsername(), response.body());
            } else {
                log.warn("[WebPush] Push failed for '{}': {} {}", sub.getUsername(),
                        response.statusCode(), response.body());
            }
        } catch (Exception e) {
            log.error("[WebPush] Error sending to '{}': {}", sub.getUsername(), e.getMessage());
        }
    }

    // ════════════════════════ VAPID JWT (RFC 8292) ════════════════════════

    private String createVapidJwt(String endpoint) {
        URI uri = URI.create(endpoint);
        String audience = uri.getScheme() + "://" + uri.getHost();
        long exp = Instant.now().plus(12, ChronoUnit.HOURS).getEpochSecond();

        return Jwts.builder()
                .setHeaderParam("typ", "JWT")
                .claim("aud", audience)
                .claim("exp", exp)
                .claim("sub", vapidSubject)
                .signWith(vapidPrivateKey, SignatureAlgorithm.ES256)
                .compact();
    }

    // ════════════════════════ RFC 8291 encryption ════════════════════════

    /**
     * Encrypt payload using aes128gcm content encoding (RFC 8291).
     */
    private byte[] encryptPayload(String payload, String p256dhBase64, String authBase64) throws Exception {
        byte[] userPublicKeyBytes = Base64.getUrlDecoder().decode(p256dhBase64);
        byte[] authSecret = Base64.getUrlDecoder().decode(authBase64);
        byte[] plaintext = payload.getBytes(StandardCharsets.UTF_8);

        // 1. Generate ephemeral ECDH key pair
        KeyPairGenerator kpg = KeyPairGenerator.getInstance("EC");
        kpg.initialize(new ECGenParameterSpec("secp256r1"));
        KeyPair ephemeral = kpg.generateKeyPair();
        byte[] ephPubBytes = encodeUncompressedPoint((ECPublicKey) ephemeral.getPublic());

        // 2. Decode subscriber's public key & perform ECDH
        ECPublicKey userPublicKey = decodePublicKey(userPublicKeyBytes);
        KeyAgreement ka = KeyAgreement.getInstance("ECDH");
        ka.init(ephemeral.getPrivate());
        ka.doPhase(userPublicKey, true);
        byte[] sharedSecret = ka.generateSecret();

        // 3. Derive IKM via HKDF
        // PRK_key = HKDF-Extract(auth_secret, ecdh_secret)
        byte[] prkKey = hkdfExtract(authSecret, sharedSecret);

        // key_info = "WebPush: info\0" || ua_public || as_public
        byte[] keyInfoPrefix = "WebPush: info\0".getBytes(StandardCharsets.UTF_8);
        byte[] keyInfo = concat(keyInfoPrefix, userPublicKeyBytes, ephPubBytes);

        // IKM = HKDF-Expand(PRK_key, key_info, 32)
        byte[] ikm = hkdfExpand(prkKey, keyInfo, 32);

        // 4. Generate random salt
        byte[] salt = new byte[16];
        SecureRandom.getInstanceStrong().nextBytes(salt);

        // 5. Derive content encryption key & nonce
        byte[] prk = hkdfExtract(salt, ikm);

        byte[] cekInfo = "Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.UTF_8);
        byte[] cek = hkdfExpand(prk, cekInfo, 16);

        byte[] nonceInfo = "Content-Encoding: nonce\0".getBytes(StandardCharsets.UTF_8);
        byte[] nonce = hkdfExpand(prk, nonceInfo, 12);

        // 6. Pad plaintext + final record delimiter (0x02)
        byte[] paddedPayload = new byte[plaintext.length + 1];
        System.arraycopy(plaintext, 0, paddedPayload, 0, plaintext.length);
        paddedPayload[plaintext.length] = 0x02;

        // 7. Encrypt with AES-128-GCM
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE,
                new SecretKeySpec(cek, "AES"),
                new GCMParameterSpec(128, nonce));
        byte[] ciphertext = cipher.doFinal(paddedPayload);

        // 8. Build aes128gcm body: salt(16) || rs(4) || idlen(1) || keyid(65) || ciphertext
        ByteBuffer body = ByteBuffer.allocate(16 + 4 + 1 + ephPubBytes.length + ciphertext.length);
        body.put(salt);
        body.putInt(4096); // record size
        body.put((byte) ephPubBytes.length);
        body.put(ephPubBytes);
        body.put(ciphertext);

        return body.array();
    }

    // ════════════════════════ Crypto helpers ════════════════════════

    /** HKDF-Extract: PRK = HMAC-SHA256(salt, IKM) */
    private byte[] hkdfExtract(byte[] salt, byte[] ikm) throws Exception {
        Mac hmac = Mac.getInstance("HmacSHA256");
        hmac.init(new SecretKeySpec(salt.length > 0 ? salt : new byte[32], "HmacSHA256"));
        return hmac.doFinal(ikm);
    }

    /** HKDF-Expand: OKM = first `length` bytes of HMAC-SHA256(PRK, info || 0x01) */
    private byte[] hkdfExpand(byte[] prk, byte[] info, int length) throws Exception {
        Mac hmac = Mac.getInstance("HmacSHA256");
        hmac.init(new SecretKeySpec(prk, "HmacSHA256"));
        byte[] input = new byte[info.length + 1];
        System.arraycopy(info, 0, input, 0, info.length);
        input[info.length] = 0x01;
        byte[] t = hmac.doFinal(input);
        return Arrays.copyOf(t, length);
    }

    /** Decode 65-byte uncompressed EC point to ECPublicKey */
    private ECPublicKey decodePublicKey(byte[] uncompressedPoint) throws Exception {
        if (uncompressedPoint.length != 65 || uncompressedPoint[0] != 0x04) {
            throw new IllegalArgumentException("Invalid uncompressed EC point");
        }
        byte[] x = Arrays.copyOfRange(uncompressedPoint, 1, 33);
        byte[] y = Arrays.copyOfRange(uncompressedPoint, 33, 65);
        ECPoint point = new ECPoint(new BigInteger(1, x), new BigInteger(1, y));
        ECPublicKeySpec keySpec = new ECPublicKeySpec(point, ecSpec);
        return (ECPublicKey) KeyFactory.getInstance("EC").generatePublic(keySpec);
    }

    /** Encode ECPublicKey as 65-byte uncompressed point (0x04 || x || y) */
    private byte[] encodeUncompressedPoint(ECPublicKey key) {
        byte[] x = toFixedLength(key.getW().getAffineX().toByteArray(), 32);
        byte[] y = toFixedLength(key.getW().getAffineY().toByteArray(), 32);
        byte[] result = new byte[65];
        result[0] = 0x04;
        System.arraycopy(x, 0, result, 1, 32);
        System.arraycopy(y, 0, result, 33, 32);
        return result;
    }

    /** Ensure byte array is exactly `length` bytes (trim leading zeros or pad) */
    private byte[] toFixedLength(byte[] input, int length) {
        if (input.length == length) return input;
        if (input.length > length) {
            return Arrays.copyOfRange(input, input.length - length, input.length);
        }
        byte[] result = new byte[length];
        System.arraycopy(input, 0, result, length - input.length, input.length);
        return result;
    }

    /** Concatenate byte arrays */
    private byte[] concat(byte[]... arrays) {
        int total = 0;
        for (byte[] a : arrays) total += a.length;
        byte[] result = new byte[total];
        int offset = 0;
        for (byte[] a : arrays) {
            System.arraycopy(a, 0, result, offset, a.length);
            offset += a.length;
        }
        return result;
    }

    private String now() {
        return LocalDateTime.now().format(FORMATTER);
    }
}
