package com.example.webrtcchat.service;

import com.example.webrtcchat.entity.KeyBundleEntity;
import com.example.webrtcchat.entity.OneTimePreKeyEntity;
import com.example.webrtcchat.repository.KeyBundleRepository;
import com.example.webrtcchat.repository.OneTimePreKeyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class KeyBundleService {

    private final KeyBundleRepository bundleRepo;
    private final OneTimePreKeyRepository otkRepo;

    public KeyBundleService(KeyBundleRepository bundleRepo, OneTimePreKeyRepository otkRepo) {
        this.bundleRepo = bundleRepo;
        this.otkRepo = otkRepo;
    }

    /**
     * Upload or update a user's key bundle.
     */
    @Transactional
    public void uploadBundle(String username, String identityKey, String signingKey,
                             String signedPreKey, String signedPreKeySignature,
                             List<Map<String, Object>> oneTimePreKeys) {
        KeyBundleEntity bundle = bundleRepo.findByUsername(username).orElse(new KeyBundleEntity());
        bundle.setUsername(username);
        bundle.setIdentityKey(identityKey);
        bundle.setSigningKey(signingKey);
        bundle.setSignedPreKey(signedPreKey);
        bundle.setSignedPreKeySignature(signedPreKeySignature);
        bundleRepo.save(bundle);

        // Replace all one-time pre-keys
        otkRepo.deleteAllByUsername(username);
        if (oneTimePreKeys != null) {
            for (Map<String, Object> otk : oneTimePreKeys) {
                int keyId = ((Number) otk.get("id")).intValue();
                String publicKey = (String) otk.get("publicKey");
                otkRepo.save(new OneTimePreKeyEntity(username, keyId, publicKey));
            }
        }
    }

    /**
     * Fetch a user's key bundle for X3DH. Consumes one OTK (if available).
     */
    @Transactional
    public Map<String, Object> fetchBundle(String username) {
        KeyBundleEntity bundle = bundleRepo.findByUsername(username)
                .orElseThrow(() -> new NoSuchElementException("No key bundle for user: " + username));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("username", username);
        result.put("identityKey", bundle.getIdentityKey());
        result.put("signingKey", bundle.getSigningKey());
        result.put("signedPreKey", bundle.getSignedPreKey());
        result.put("signedPreKeySignature", bundle.getSignedPreKeySignature());

        // Consume one OTK (first available)
        Optional<OneTimePreKeyEntity> otk = otkRepo.findFirstByUsername(username);
        if (otk.isPresent()) {
            OneTimePreKeyEntity key = otk.get();
            result.put("oneTimeKeyId", key.getKeyId());
            result.put("oneTimeKey", key.getPublicKey());
            otkRepo.delete(key);
        } else {
            result.put("oneTimeKeyId", null);
            result.put("oneTimeKey", null);
        }

        return result;
    }

    /**
     * Replenish one-time pre-keys.
     */
    @Transactional
    public void replenishKeys(String username, List<Map<String, Object>> newKeys) {
        if (!bundleRepo.existsByUsername(username)) {
            throw new NoSuchElementException("No key bundle for user: " + username);
        }
        if (newKeys != null) {
            for (Map<String, Object> otk : newKeys) {
                int keyId = ((Number) otk.get("id")).intValue();
                String publicKey = (String) otk.get("publicKey");
                otkRepo.save(new OneTimePreKeyEntity(username, keyId, publicKey));
            }
        }
    }

    /**
     * Get count of remaining one-time pre-keys for a user.
     */
    @Transactional(readOnly = true)
    public long getOneTimeKeyCount(String username) {
        return otkRepo.countByUsername(username);
    }

    /**
     * Check if a user has a key bundle.
     */
    @Transactional(readOnly = true)
    public boolean hasBundle(String username) {
        return bundleRepo.existsByUsername(username);
    }
}
