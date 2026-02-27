// ==========================================
// Conference Context — group video call (full-mesh) state management
// ==========================================
import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { onConferenceMessage, sendWsMessage } from "../services/wsService";
import {
  createPeerConnection,
  getUserMediaStream,
} from "../services/webrtcService";
import { apiFetch } from "../services/apiHelper";

const ConferenceContext = createContext();

export const CONF_STATE = {
  IDLE: "idle",
  JOINING: "joining",
  ACTIVE: "active",
};

function ConferenceProvider({ children }) {
  const [confState, setConfState] = useState(CONF_STATE.IDLE);
  const [confId, setConfId] = useState(null);
  const [confRoomId, setConfRoomId] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [peerStreams, setPeerStreams] = useState({}); // { peerId: MediaStream }
  const [participants, setParticipants] = useState([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const pcsRef = useRef({}); // { peerId: RTCPeerConnection }
  const pendingIceRef = useRef({}); // { peerId: [candidate strings] }
  const localStreamRef = useRef(null);
  const stateRef = useRef(CONF_STATE.IDLE);
  const confIdRef = useRef(null);
  const myUsername = localStorage.getItem("username");

  useEffect(() => {
    stateRef.current = confState;
  }, [confState]);
  useEffect(() => {
    confIdRef.current = confId;
  }, [confId]);

  // ====== cleanup ======
  const cleanup = useCallback(() => {
    Object.values(pcsRef.current).forEach((pc) => pc.close());
    pcsRef.current = {};
    pendingIceRef.current = {};
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setPeerStreams({});
    setParticipants([]);
    setConfState(CONF_STATE.IDLE);
    setConfId(null);
    setConfRoomId(null);
    setIsAudioMuted(false);
    setIsVideoOff(false);
  }, []);

  // ====== Create peer connection for a specific remote peer ======
  const createPeerForRemote = useCallback(
    async (peerId, stream, roomId, isInitiator) => {
      if (pcsRef.current[peerId]) {
        pcsRef.current[peerId].close();
      }

      const pc = await createPeerConnection({
        onIceCandidate: (candidate) => {
          sendWsMessage({
            type: "CONF_ICE",
            roomId: roomId,
            content: "",
            extra: {
              target: peerId,
              confId: confIdRef.current,
              candidate: JSON.stringify(candidate),
            },
          });
        },
        onTrack: (remoteStream) => {
          setPeerStreams((prev) => ({ ...prev, [peerId]: remoteStream }));
        },
        onConnectionStateChange: (state) => {
          if (state === "disconnected" || state === "failed") {
            if (pcsRef.current[peerId]) {
              pcsRef.current[peerId].close();
              delete pcsRef.current[peerId];
            }
            setPeerStreams((prev) => {
              const n = { ...prev };
              delete n[peerId];
              return n;
            });
          }
        },
      });

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      pcsRef.current[peerId] = pc;

      if (isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendWsMessage({
          type: "CONF_OFFER",
          roomId: roomId,
          content: "",
          extra: {
            target: peerId,
            confId: confIdRef.current,
            sdp: JSON.stringify(offer),
          },
        });
      }

      return pc;
    },
    [],
  );

  // ====== Start / join conference ======
  const startConference = useCallback(
    async (roomId, type = "video") => {
      if (stateRef.current !== CONF_STATE.IDLE) return;

      try {
        setConfState(CONF_STATE.JOINING);
        setConfRoomId(roomId);

        const stream = await getUserMediaStream(type);
        localStreamRef.current = stream;
        setLocalStream(stream);

        // Create or join conference via REST
        let conference;
        try {
          conference = await apiFetch("/api/conference", {
            method: "POST",
            body: JSON.stringify({ roomId }),
          });
        } catch {
          // Conference might already exist, try to get it
          const rooms = await apiFetch(`/api/rooms/${encodeURIComponent(roomId)}`);
          // Try joining any active conference
          conference = { id: roomId + "-conf" };
        }

        const cId = conference.id || conference.confId;
        setConfId(cId);

        // Join conference
        try {
          await apiFetch(`/api/conference/${encodeURIComponent(cId)}/join`, {
            method: "POST",
          });
        } catch (e) {
          console.warn("[Conf] Join REST failed, trying WS:", e);
        }

        // Send CONF_JOIN via WebSocket
        sendWsMessage({
          type: "CONF_JOIN",
          roomId: roomId,
          content: "",
          extra: { confId: cId },
        });

        setConfState(CONF_STATE.ACTIVE);
      } catch (e) {
        console.error("[Conf] Failed to start conference:", e);
        cleanup();
      }
    },
    [cleanup],
  );

  // ====== Leave conference ======
  const leaveConference = useCallback(() => {
    if (stateRef.current === CONF_STATE.IDLE) return;

    // Notify via WS
    sendWsMessage({
      type: "CONF_LEAVE",
      roomId: confRoomId,
      content: "",
      extra: { confId: confIdRef.current },
    });

    // Leave via REST
    if (confIdRef.current) {
      apiFetch(
        `/api/conference/${encodeURIComponent(confIdRef.current)}/leave`,
        { method: "POST" },
      ).catch(() => {});
    }

    cleanup();
  }, [confRoomId, cleanup]);

  // ====== Toggle audio mute ======
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !t.enabled;
      });
      setIsAudioMuted((p) => !p);
    }
  }, []);

  // ====== Toggle video ======
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = !t.enabled;
      });
      setIsVideoOff((p) => !p);
    }
  }, []);

  // ====== WS conference message listener ======
  useEffect(() => {
    const unsub = onConferenceMessage((msg) => {
      const extra = msg.extra || {};
      const sender = msg.sender;

      switch (msg.type) {
        case "CONF_PEERS": {
          // Server sent list of current peers as comma-separated string
          const raw = extra.peers || "";
          const peers = typeof raw === "string"
            ? raw.split(",").filter(Boolean)
            : Array.isArray(raw) ? raw : [];
          setParticipants(peers);

          // Create offers to all existing peers
          if (localStreamRef.current) {
            peers.forEach((peerId) => {
              if (peerId !== myUsername) {
                createPeerForRemote(
                  peerId,
                  localStreamRef.current,
                  msg.roomId,
                  true,
                );
              }
            });
          }
          break;
        }

        case "CONF_OFFER": {
          // Someone sent us an offer
          if (!localStreamRef.current) return;

          (async () => {
            try {
              const pc = await createPeerForRemote(
                sender,
                localStreamRef.current,
                msg.roomId,
                false,
              );

              const offer = JSON.parse(extra.sdp);
              await pc.setRemoteDescription(new RTCSessionDescription(offer));

              // Flush pending ICE candidates for this peer
              const pending = pendingIceRef.current[sender] || [];
              for (const c of pending) {
                try { await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(c))); } catch {}
              }
              delete pendingIceRef.current[sender];

              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);

              sendWsMessage({
                type: "CONF_ANSWER",
                roomId: msg.roomId,
                content: "",
                extra: {
                  target: sender,
                  confId: extra.confId,
                  sdp: JSON.stringify(answer),
                },
              });
            } catch (e) {
              console.error("[Conf] Failed to handle offer from", sender, e);
            }
          })();
          break;
        }

        case "CONF_ANSWER": {
          // Someone answered our offer
          const pc = pcsRef.current[sender];
          if (!pc) return;

          (async () => {
            try {
              const answer = JSON.parse(extra.sdp);
              await pc.setRemoteDescription(new RTCSessionDescription(answer));

              // Flush pending ICE candidates for this peer
              const pending = pendingIceRef.current[sender] || [];
              for (const c of pending) {
                try { await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(c))); } catch {}
              }
              delete pendingIceRef.current[sender];
            } catch (e) {
              console.error(
                "[Conf] Failed to handle answer from",
                sender,
                e,
              );
            }
          })();
          break;
        }

        case "CONF_ICE": {
          const pc = pcsRef.current[sender];
          if (pc && pc.remoteDescription) {
            try {
              pc.addIceCandidate(
                new RTCIceCandidate(JSON.parse(extra.candidate)),
              );
            } catch (e) {
              console.warn("[Conf] ICE add error:", e);
            }
          } else {
            // Queue until PeerConnection + remote description are ready
            if (!pendingIceRef.current[sender]) pendingIceRef.current[sender] = [];
            pendingIceRef.current[sender].push(extra.candidate);
          }
          break;
        }

        case "CONF_JOIN": {
          // New participant joined
          if (sender === myUsername) return;
          setParticipants((prev) =>
            prev.includes(sender) ? prev : [...prev, sender],
          );
          break;
        }

        case "CONF_LEAVE": {
          // Participant left
          if (pcsRef.current[sender]) {
            pcsRef.current[sender].close();
            delete pcsRef.current[sender];
          }
          delete pendingIceRef.current[sender];
          setPeerStreams((prev) => {
            const n = { ...prev };
            delete n[sender];
            return n;
          });
          setParticipants((prev) => prev.filter((p) => p !== sender));
          break;
        }

        default:
          break;
      }
    });

    return unsub;
  }, [myUsername, createPeerForRemote]);

  const value = {
    confState,
    confId,
    confRoomId,
    localStream,
    peerStreams,
    participants,
    isAudioMuted,
    isVideoOff,
    startConference,
    leaveConference,
    toggleAudio,
    toggleVideo,
    CONF_STATE,
  };

  return (
    <ConferenceContext.Provider value={value}>
      {children}
    </ConferenceContext.Provider>
  );
}

function useConference() {
  const ctx = useContext(ConferenceContext);
  if (!ctx)
    throw new Error("useConference must be used within ConferenceProvider");
  return ctx;
}

export { ConferenceProvider, useConference };
