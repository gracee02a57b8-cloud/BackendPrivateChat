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
import { onConferenceMessage, sendWsMessage, isWsConnected } from "../services/wsService";
import {
  createPeerConnection,
  getUserMediaStream,
} from "../services/webrtcService";
import { apiFetch } from "../services/apiHelper";
import toast from "react-hot-toast";

const ConferenceContext = createContext();

export const CONF_STATE = {
  IDLE: "idle",
  JOINING: "joining",
  ACTIVE: "active",
};

export const MAX_PARTICIPANTS = 10;

function ConferenceProvider({ children }) {
  const [confState, setConfState] = useState(CONF_STATE.IDLE);
  const [confId, setConfId] = useState(null);
  const [confRoomId, setConfRoomId] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [peerStreams, setPeerStreams] = useState({}); // { peerId: MediaStream }
  const [participants, setParticipants] = useState([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

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

  // Ref to let WS listener call startConference without stale closure
  const startConferenceRef = useRef(null);

  // Cleanup on unmount (e.g. route change while in conference)
  useEffect(() => {
    return () => {
      Object.values(pcsRef.current).forEach((pc) => pc.close());
      pcsRef.current = {};
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
    };
  }, []);

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
    stateRef.current = CONF_STATE.IDLE;
    setConfState(CONF_STATE.IDLE);
    confIdRef.current = null;
    setConfId(null);
    setConfRoomId(null);
    setIsAudioMuted(false);
    setIsVideoOff(false);
    setIsMinimized(false);
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
          if (state === "disconnected") {
            // Temporary network issue — wait for recovery
            setTimeout(() => {
              const pc = pcsRef.current[peerId];
              if (pc && pc.connectionState !== "connected") {
                console.warn("[Conf] Peer", peerId, "did not recover, closing");
                pc.close();
                delete pcsRef.current[peerId];
                setPeerStreams((prev) => {
                  const n = { ...prev };
                  delete n[peerId];
                  return n;
                });
              }
            }, 10_000);
          } else if (state === "failed") {
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
    async (roomId, type = "video", autoInviteUser = null) => {
      if (stateRef.current !== CONF_STATE.IDLE) return;

      if (!isWsConnected()) {
        console.warn("[Conf] Cannot start conference — WebSocket not connected");
        toast.error("Нет подключения к серверу");
        return;
      }

      try {
        stateRef.current = CONF_STATE.JOINING;
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
        } catch (e) {
          console.warn("[Conf] Create conference REST failed, trying to find active one:", e);
          // Conference might already exist — try to get info
          try {
            conference = await apiFetch(`/api/conference/room/${encodeURIComponent(roomId)}`);
          } catch {
            conference = null;
          }
        }

        const cId = conference?.confId || conference?.id;
        if (!cId) {
          console.error("[Conf] No conference ID available");
          cleanup();
          return;
        }
        confIdRef.current = cId;
        setConfId(cId);

        // Join conference via REST
        try {
          await apiFetch(`/api/conference/${encodeURIComponent(cId)}/join`, {
            method: "POST",
          });
        } catch (e) {
          console.warn("[Conf] Join REST failed, continuing with WS:", e);
        }

        // Send CONF_JOIN via WebSocket
        sendWsMessage({
          type: "CONF_JOIN",
          roomId: roomId,
          content: "",
          extra: { confId: cId },
        });

        // Notify group about conference start
        sendWsMessage({
          type: "CHAT",
          roomId: roomId,
          content: type === "audio"
            ? "📞 Начат групповой аудиозвонок. Присоединяйтесь!"
            : "📹 Начата видеоконференция. Присоединяйтесь!",
        });

        // Auto-invite user (e.g. escalation from 1:1 call)
        if (autoInviteUser) {
          sendWsMessage({
            type: "CONF_INVITE",
            roomId: roomId,
            content: "",
            extra: {
              target: autoInviteUser,
              confId: cId,
              inviteLink: `${window.location.origin}/conference/${cId}`,
              autoJoin: "true",
            },
          });
        }

        stateRef.current = CONF_STATE.ACTIVE;
        setConfState(CONF_STATE.ACTIVE);
      } catch (e) {
        console.error("[Conf] Failed to start conference:", e);
        cleanup();
      }
    },
    [cleanup],
  );

  // Keep ref in sync so WS listener can call startConference
  useEffect(() => {
    startConferenceRef.current = startConference;
  }, [startConference]);

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

  // ====== Toggle minimize ======
  const toggleMinimize = useCallback(() => {
    setIsMinimized((p) => !p);
  }, []);

  // ====== Join existing conference by confId (invite link) ======
  const joinConferenceById = useCallback(
    async (targetConfId, type = "video") => {
      if (stateRef.current !== CONF_STATE.IDLE) return null;

      if (!isWsConnected()) {
        console.warn("[Conf] Cannot join conference — WebSocket not connected");
        toast.error("Нет подключения к серверу");
        return null;
      }

      try {
        stateRef.current = CONF_STATE.JOINING;
        setConfState(CONF_STATE.JOINING);

        // Fetch conference info via REST
        const info = await apiFetch(
          `/api/conference/${encodeURIComponent(targetConfId)}`,
        );
        if (!info) throw new Error("Конференция не найдена");

        const roomId = info.roomId || null;
        setConfRoomId(roomId);
        confIdRef.current = targetConfId;
        setConfId(targetConfId);

        // Get user media
        const stream = await getUserMediaStream(type);
        localStreamRef.current = stream;
        setLocalStream(stream);

        // Join via REST
        try {
          await apiFetch(
            `/api/conference/${encodeURIComponent(targetConfId)}/join`,
            { method: "POST" },
          );
        } catch (e) {
          console.warn("[Conf] Join REST failed:", e);
        }

        // Send CONF_JOIN via WS
        sendWsMessage({
          type: "CONF_JOIN",
          roomId: roomId || "",
          content: "",
          extra: { confId: targetConfId },
        });

        stateRef.current = CONF_STATE.ACTIVE;
        setConfState(CONF_STATE.ACTIVE);
        return roomId;
      } catch (e) {
        console.error("[Conf] Failed to join conference by id:", e);
        cleanup();
        throw e;
      }
    },
    [cleanup],
  );

  // ====== Get invite link for current conference ======
  const getInviteLink = useCallback(() => {
    if (!confIdRef.current) return null;
    return `${window.location.origin}/conference/${confIdRef.current}`;
  }, []);

  // ====== Invite a specific user to the conference via WS ======
  const inviteUser = useCallback((targetUsername, autoJoin = false) => {
    if (stateRef.current !== CONF_STATE.ACTIVE) {
      toast.error("Нет активной конференции");
      return;
    }
    if (!confIdRef.current) return;

    const totalNow = 1 + Object.keys(pcsRef.current).length; // me + peers
    if (totalNow >= MAX_PARTICIPANTS) {
      toast.error(`Максимум ${MAX_PARTICIPANTS} участников`);
      return;
    }

    if (!isWsConnected()) {
      toast.error("Нет подключения к серверу");
      return;
    }

    sendWsMessage({
      type: "CONF_INVITE",
      roomId: confRoomId || "",
      content: "",
      extra: {
        target: targetUsername,
        confId: confIdRef.current,
        inviteLink: `${window.location.origin}/conference/${confIdRef.current}`,
        autoJoin: autoJoin ? "true" : "",
      },
    });

    toast.success(`Приглашение отправлено: ${targetUsername}`);
  }, [confRoomId]);

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
          toast(`${sender} присоединился`, { icon: "👋" });
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
          toast(`${sender} покинул конференцию`, { icon: "👋" });
          break;
        }

        case "CONF_INVITE": {
          // Someone invited us to a conference
          const invConfId = extra.confId;
          const invLink = extra.inviteLink;
          const isAutoJoin = extra.autoJoin === "true";
          if (!invConfId) break;

          // Don't show invite if already in this conference
          if (stateRef.current !== CONF_STATE.IDLE) break;

          // Auto-join when escalating from 1:1 call (no manual accept needed)
          if (isAutoJoin && startConferenceRef.current) {
            const invRoomId = msg.roomId || "";
            startConferenceRef.current(invRoomId, "video");
            break;
          }

          toast(
            (t) => (
              <div className="flex flex-col gap-2">
                <span className="font-medium">📹 {sender} приглашает в конференцию</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      toast.dismiss(t.id);
                      // Navigate to conference join
                      window.location.href = invLink || `/conference/${invConfId}`;
                    }}
                    className="rounded-lg bg-green-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-600"
                  >
                    Присоединиться
                  </button>
                  <button
                    onClick={() => toast.dismiss(t.id)}
                    className="rounded-lg bg-gray-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-600"
                  >
                    Отклонить
                  </button>
                </div>
              </div>
            ),
            { duration: 30000, icon: "📹" }
          );
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
    isMinimized,
    startConference,
    joinConferenceById,
    getInviteLink,
    inviteUser,
    leaveConference,
    toggleAudio,
    toggleVideo,
    toggleMinimize,
    MAX_PARTICIPANTS,
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
