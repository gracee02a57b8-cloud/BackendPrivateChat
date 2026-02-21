package com.example.webrtcchat.service;

import com.example.webrtcchat.entity.KeyBundleEntity;
import com.example.webrtcchat.entity.OneTimePreKeyEntity;
import com.example.webrtcchat.repository.KeyBundleRepository;
import com.example.webrtcchat.repository.OneTimePreKeyRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class KeyBundleServiceTest {

    @Mock private KeyBundleRepository bundleRepo;
    @Mock private OneTimePreKeyRepository otkRepo;

    @InjectMocks private KeyBundleService keyBundleService;

    // === uploadBundle ===

    @Test
    @DisplayName("uploadBundle creates new bundle and saves OTKs")
    void uploadBundle_newBundle() {
        when(bundleRepo.findByUsername("alice")).thenReturn(Optional.empty());
        when(bundleRepo.save(any(KeyBundleEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        List<Map<String, Object>> otks = List.of(
                Map.of("id", 0, "publicKey", "key0"),
                Map.of("id", 1, "publicKey", "key1")
        );

        keyBundleService.uploadBundle("alice", "ik", "sk", "spk", "sig", otks);

        ArgumentCaptor<KeyBundleEntity> captor = ArgumentCaptor.forClass(KeyBundleEntity.class);
        verify(bundleRepo).save(captor.capture());
        assertEquals("alice", captor.getValue().getUsername());
        assertEquals("ik", captor.getValue().getIdentityKey());
        assertEquals("sk", captor.getValue().getSigningKey());
        assertEquals("spk", captor.getValue().getSignedPreKey());
        assertEquals("sig", captor.getValue().getSignedPreKeySignature());

        verify(otkRepo).deleteAllByUsername("alice");
        verify(otkRepo, times(2)).save(any(OneTimePreKeyEntity.class));
    }

    @Test
    @DisplayName("uploadBundle updates existing bundle")
    void uploadBundle_existingBundle() {
        KeyBundleEntity existing = new KeyBundleEntity();
        existing.setUsername("alice");
        existing.setIdentityKey("old-ik");
        when(bundleRepo.findByUsername("alice")).thenReturn(Optional.of(existing));
        when(bundleRepo.save(any(KeyBundleEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        keyBundleService.uploadBundle("alice", "new-ik", "new-sk", "new-spk", "new-sig", null);

        assertEquals("new-ik", existing.getIdentityKey());
        assertEquals("new-sk", existing.getSigningKey());
        verify(bundleRepo).save(existing);
        verify(otkRepo).deleteAllByUsername("alice");
    }

    @Test
    @DisplayName("uploadBundle with null OTKs does not throw")
    void uploadBundle_nullOtks() {
        when(bundleRepo.findByUsername("bob")).thenReturn(Optional.empty());
        when(bundleRepo.save(any(KeyBundleEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        assertDoesNotThrow(() ->
                keyBundleService.uploadBundle("bob", "ik", "sk", "spk", "sig", null));

        verify(otkRepo).deleteAllByUsername("bob");
        verify(otkRepo, never()).save(any(OneTimePreKeyEntity.class));
    }

    // === fetchBundle ===

    @Test
    @DisplayName("fetchBundle returns bundle with OTK and consumes it")
    void fetchBundle_withOtk() {
        KeyBundleEntity bundle = createBundle("alice");
        when(bundleRepo.findByUsername("alice")).thenReturn(Optional.of(bundle));

        OneTimePreKeyEntity otk = new OneTimePreKeyEntity("alice", 5, "otkPub");
        when(otkRepo.findFirstByUsername("alice")).thenReturn(Optional.of(otk));

        Map<String, Object> result = keyBundleService.fetchBundle("alice");

        assertEquals("alice", result.get("username"));
        assertEquals("ik-alice", result.get("identityKey"));
        assertEquals("sk-alice", result.get("signingKey"));
        assertEquals("spk-alice", result.get("signedPreKey"));
        assertEquals("sig-alice", result.get("signedPreKeySignature"));
        assertEquals(5, result.get("oneTimeKeyId"));
        assertEquals("otkPub", result.get("oneTimeKey"));
        verify(otkRepo).delete(otk);
    }

    @Test
    @DisplayName("fetchBundle returns bundle without OTK when none available")
    void fetchBundle_noOtk() {
        KeyBundleEntity bundle = createBundle("alice");
        when(bundleRepo.findByUsername("alice")).thenReturn(Optional.of(bundle));
        when(otkRepo.findFirstByUsername("alice")).thenReturn(Optional.empty());

        Map<String, Object> result = keyBundleService.fetchBundle("alice");

        assertNull(result.get("oneTimeKeyId"));
        assertNull(result.get("oneTimeKey"));
        verify(otkRepo, never()).delete(any());
    }

    @Test
    @DisplayName("fetchBundle throws for non-existent user")
    void fetchBundle_notFound() {
        when(bundleRepo.findByUsername("ghost")).thenReturn(Optional.empty());

        assertThrows(NoSuchElementException.class,
                () -> keyBundleService.fetchBundle("ghost"));
    }

    // === replenishKeys ===

    @Test
    @DisplayName("replenishKeys adds new OTKs to existing bundle")
    void replenishKeys_success() {
        when(bundleRepo.existsByUsername("alice")).thenReturn(true);

        List<Map<String, Object>> newKeys = List.of(
                Map.of("id", 20, "publicKey", "newKey20"),
                Map.of("id", 21, "publicKey", "newKey21")
        );

        keyBundleService.replenishKeys("alice", newKeys);

        verify(otkRepo, times(2)).save(any(OneTimePreKeyEntity.class));
    }

    @Test
    @DisplayName("replenishKeys throws for non-existent bundle")
    void replenishKeys_noBundleThrows() {
        when(bundleRepo.existsByUsername("ghost")).thenReturn(false);

        assertThrows(NoSuchElementException.class,
                () -> keyBundleService.replenishKeys("ghost", List.of()));
    }

    @Test
    @DisplayName("replenishKeys with null keys does not throw")
    void replenishKeys_nullKeys() {
        when(bundleRepo.existsByUsername("alice")).thenReturn(true);

        assertDoesNotThrow(() -> keyBundleService.replenishKeys("alice", null));
        verify(otkRepo, never()).save(any());
    }

    // === getOneTimeKeyCount ===

    @Test
    @DisplayName("getOneTimeKeyCount returns count from repository")
    void getOneTimeKeyCount_returnsCount() {
        when(otkRepo.countByUsername("alice")).thenReturn(15L);

        assertEquals(15L, keyBundleService.getOneTimeKeyCount("alice"));
    }

    // === getIdentityKey ===

    @Test
    @DisplayName("getIdentityKey returns key when bundle exists")
    void getIdentityKey_found() {
        KeyBundleEntity bundle = createBundle("alice");
        when(bundleRepo.findByUsername("alice")).thenReturn(Optional.of(bundle));

        assertEquals("ik-alice", keyBundleService.getIdentityKey("alice"));
    }

    @Test
    @DisplayName("getIdentityKey returns null when no bundle")
    void getIdentityKey_notFound() {
        when(bundleRepo.findByUsername("ghost")).thenReturn(Optional.empty());

        assertNull(keyBundleService.getIdentityKey("ghost"));
    }

    // === hasBundle ===

    @Test
    @DisplayName("hasBundle returns true when bundle exists")
    void hasBundle_exists() {
        when(bundleRepo.existsByUsername("alice")).thenReturn(true);
        assertTrue(keyBundleService.hasBundle("alice"));
    }

    @Test
    @DisplayName("hasBundle returns false when no bundle")
    void hasBundle_notExists() {
        when(bundleRepo.existsByUsername("ghost")).thenReturn(false);
        assertFalse(keyBundleService.hasBundle("ghost"));
    }

    // === OTK consumption is atomic ===

    @Test
    @DisplayName("Multiple fetchBundle calls consume different OTKs")
    void fetchBundle_consumesSequentially() {
        KeyBundleEntity bundle = createBundle("alice");
        when(bundleRepo.findByUsername("alice")).thenReturn(Optional.of(bundle));

        OneTimePreKeyEntity otk1 = new OneTimePreKeyEntity("alice", 0, "key0");
        OneTimePreKeyEntity otk2 = new OneTimePreKeyEntity("alice", 1, "key1");
        when(otkRepo.findFirstByUsername("alice"))
                .thenReturn(Optional.of(otk1))
                .thenReturn(Optional.of(otk2));

        Map<String, Object> result1 = keyBundleService.fetchBundle("alice");
        Map<String, Object> result2 = keyBundleService.fetchBundle("alice");

        assertEquals(0, result1.get("oneTimeKeyId"));
        assertEquals(1, result2.get("oneTimeKeyId"));
        verify(otkRepo).delete(otk1);
        verify(otkRepo).delete(otk2);
    }

    // === Helper ===

    private KeyBundleEntity createBundle(String username) {
        KeyBundleEntity bundle = new KeyBundleEntity();
        bundle.setUsername(username);
        bundle.setIdentityKey("ik-" + username);
        bundle.setSigningKey("sk-" + username);
        bundle.setSignedPreKey("spk-" + username);
        bundle.setSignedPreKeySignature("sig-" + username);
        return bundle;
    }
}
