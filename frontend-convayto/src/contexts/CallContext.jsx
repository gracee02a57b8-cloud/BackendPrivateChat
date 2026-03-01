// ==========================================
// Call Context — 1:1 voice & video call state management
// ==========================================
import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import {
  onCallMessage,
  sendWsMessage,
  isWsConnected,
  connectWebSocket,
} from "../services/wsService";
import {
  createPeerConnection,
  getUserMediaStream,
} from "../services/webrtcService";
import toast from "react-hot-toast";

const CallContext = createContext();

export const CALL_STATE = {
  IDLE: "idle",
  CALLING: "calling", // outgoing, waiting for answer
  RINGING: "ringing", // incoming, waiting for user to accept
  ACTIVE: "active", // call in progress
  ESCALATING: "escalating", // transitioning 1:1 call → conference
};

function CallProvider({ children }) {
  const [callState, setCallState] = useState(CALL_STATE.IDLE);
  const [callType, setCallType] = useState(null); // "audio" | "video"
  const [remoteUser, setRemoteUser] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const pcRef = useRef(null);
  const durationRef = useRef(null);
  const callTimeoutRef = useRef(null);
  const pendingIceRef = useRef([]);
  const callStartRef = useRef(null);
  const localStreamRef = useRef(null);
  const incomingDataRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const acceptingRef = useRef(false);
  const stateRef = useRef(CALL_STATE.IDLE);

  // Keep stateRef in sync
  useEffect(() => {
    stateRef.current = callState;
  }, [callState]);

  // ====== cleanup ======
  const cleanup = useCallback(() => {
    stateRef.current = CALL_STATE.IDLE;
    acceptingRef.current = false;
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (durationRef.current) {
      clearInterval(durationRef.current);
      durationRef.current = null;
    }
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setCallState(CALL_STATE.IDLE);
    setCallType(null);
    setRemoteUser(null);
    setRoomId(null);
    setIsAudioMuted(false);
    setIsVideoOff(false);
    setCallDuration(0);
    setIsMinimized(false);
    setIsReconnecting(false);
    pendingIceRef.current = [];
    callStartRef.current = null;
    incomingDataRef.current = null;
  }, []);

  // Cleanup on unmount (e.g. route change while in call)
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // ====== Start outgoing call ======
  const startCall = useCallback(
    async (targetUser, room, type = "audio") => {
      if (stateRef.current !== CALL_STATE.IDLE) return;

      if (!isWsConnected()) {
        console.warn("[Call] Cannot start call — WebSocket not connected, reconnecting...");
        connectWebSocket();
        return;
      }

      console.log("[Call] Starting call to", targetUser, "room=", room, "type=", type);

      try {
        setCallState(CALL_STATE.CALLING);
        setCallType(type);
        setRemoteUser(targetUser);
        setRoomId(room);

        console.log("[Call] Requesting media...");
        let stream;
        let actualType = type;
        try {
          stream = await getUserMediaStream(type);
        } catch (mediaErr) {
          if (type === "video") {
            console.warn("[Call] Video failed, camera unavailable:", mediaErr.message);
            actualType = "audio";
            setIsVideoOff(true);
            stream = await getUserMediaStream("audio");
          } else {
            throw mediaErr;
          }
        }
        console.log("[Call] Got media stream, tracks:", stream.getTracks().length);
        localStreamRef.current = stream;
        setLocalStream(stream);

        const pc = await createPeerConnection({
          onIceCandidate: (candidate) => {
            sendWsMessage({
              type: "ICE_CANDIDATE",
              roomId: room,
              content: "",
              extra: {
                target: targetUser,
                candidate: JSON.stringify(candidate),
              },
            });
          },
          onTrack: (remoteStr) => setRemoteStream(remoteStr),
          onConnectionStateChange: (state) => {
            if (state === "disconnected") {
              console.warn("[Call] Connection disconnected, waiting for recovery...");
              setIsReconnecting(true);
              if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
              reconnectTimeoutRef.current = setTimeout(() => {
                if (pcRef.current && pcRef.current.connectionState !== "connected") {
                  sendWsMessage({
                    type: "CALL_END",
                    roomId: room,
                    content: "",
                    extra: { target: targetUser, reason: "ice_failed" },
                  });
                  cleanup();
                }
              }, 15_000);
            } else if (state === "connected") {
              setIsReconnecting(false);
              if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
              }
            } else if (state === "failed") {
              sendWsMessage({
                type: "CALL_END",
                roomId: room,
                content: "",
                extra: { target: targetUser, reason: "ice_failed" },
              });
              cleanup();
            }
          },
        });

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        pcRef.current = pc;

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const offerSent = sendWsMessage({
          type: "CALL_OFFER",
          roomId: room,
          content: "",
          extra: {
            target: targetUser,
            callType: type,
            sdp: JSON.stringify(offer),
          },
        });
        if (!offerSent) {
          console.error("[Call] Failed to send CALL_OFFER — WS disconnected");
          cleanup();
          return;
        }

        // 45s timeout: auto-end if no answer
        callTimeoutRef.current = setTimeout(() => {
          if (stateRef.current === CALL_STATE.CALLING) {
            sendWsMessage({
              type: "CALL_END",
              roomId: room,
              content: "",
              extra: { target: targetUser, reason: "timeout" },
            });
            cleanup();
          }
        }, 45_000);
      } catch (e) {
        console.error("[Call] Failed to start call:", e);
        // If offer was already sent, notify callee we're ending
        if (pcRef.current) {
          sendWsMessage({
            type: "CALL_END",
            roomId: room,
            content: "",
            extra: { target: targetUser, reason: "error" },
          });
        }
        cleanup();
      }
    },
    [cleanup],
  );

  // ====== Accept incoming call ======
  const acceptCall = useCallback(async () => {
    if (stateRef.current !== CALL_STATE.RINGING) return;
    if (acceptingRef.current) return;
    acceptingRef.current = true;

    const data = incomingDataRef.current;
    if (!data) return;

    if (!isWsConnected()) {
      console.warn("[Call] Cannot accept call — WebSocket not connected");
      cleanup();
      return;
    }

    console.log("[Call] Accepting call from", data.sender, "room=", data.roomId, "type=", data.callType);

    try {
      setCallState(CALL_STATE.ACTIVE);
      const type = data.callType || "audio";

      console.log("[Call] Requesting media for accept...");
      let stream;
      try {
        stream = await getUserMediaStream(type);
      } catch (mediaErr) {
        if (type === "video") {
          console.warn("[Call] Video failed on accept, camera unavailable:", mediaErr.message);
          setIsVideoOff(true);
          stream = await getUserMediaStream("audio");
        } else {
          throw mediaErr;
        }
      }
      console.log("[Call] Got media stream for accept, tracks:", stream.getTracks().length);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const caller = data.sender;
      const room = data.roomId;

      const pc = await createPeerConnection({
        onIceCandidate: (candidate) => {
          sendWsMessage({
            type: "ICE_CANDIDATE",
            roomId: room,
            content: "",
            extra: {
              target: caller,
              candidate: JSON.stringify(candidate),
            },
          });
        },
        onTrack: (remoteStr) => setRemoteStream(remoteStr),
        onConnectionStateChange: (state) => {
          if (state === "disconnected") {
            console.warn("[Call] Connection disconnected, waiting for recovery...");
            setIsReconnecting(true);
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = setTimeout(() => {
              if (pcRef.current && pcRef.current.connectionState !== "connected") {
                sendWsMessage({
                  type: "CALL_END",
                  roomId: room,
                  content: "",
                  extra: { target: caller, reason: "ice_failed" },
                });
                cleanup();
              }
            }, 15_000);
          } else if (state === "connected") {
            setIsReconnecting(false);
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
              reconnectTimeoutRef.current = null;
            }
          } else if (state === "failed") {
            sendWsMessage({
              type: "CALL_END",
              roomId: room,
              content: "",
              extra: { target: caller, reason: "ice_failed" },
            });
            cleanup();
          }
        },
      });

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      pcRef.current = pc;

      // Set remote offer
      const offer = JSON.parse(data.sdp);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log("[Call] Remote offer set, flushing", pendingIceRef.current.length, "pending ICE candidates");

      // Flush pending ICE candidates
      for (const c of pendingIceRef.current) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(c)));
        } catch {}
      }
      pendingIceRef.current = [];

      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const answerSent = sendWsMessage({
        type: "CALL_ANSWER",
        roomId: room,
        content: "",
        extra: { target: caller, sdp: JSON.stringify(answer) },
      });
      if (!answerSent) {
        console.error("[Call] Failed to send CALL_ANSWER — WS disconnected");
        cleanup();
        return;
      }
      console.log("[Call] CALL_ANSWER sent to", caller);

      // Start duration timer
      callStartRef.current = Date.now();
      durationRef.current = setInterval(() => {
        setCallDuration(
          Math.floor((Date.now() - callStartRef.current) / 1000),
        );
      }, 1000);
    } catch (e) {
      console.error("[Call] Failed to accept call:", e);
      // Notify caller that we failed to accept
      if (data) {
        sendWsMessage({
          type: "CALL_REJECT",
          roomId: data.roomId,
          content: "",
          extra: { target: data.sender },
        });
      }
      cleanup();
    }
  }, [cleanup]);

  // ====== Reject incoming call ======
  const rejectCall = useCallback(() => {
    if (stateRef.current !== CALL_STATE.RINGING) return;

    const data = incomingDataRef.current;
    sendWsMessage({
      type: "CALL_REJECT",
      roomId: data?.roomId || roomId,
      content: "",
      extra: { target: data?.sender || remoteUser },
    });

    cleanup();
  }, [roomId, remoteUser, cleanup]);

  // ====== End active/outgoing call ======
  const endCall = useCallback(() => {
    if (stateRef.current === CALL_STATE.IDLE) return;

    sendWsMessage({
      type: "CALL_END",
      roomId: roomId,
      content: "",
      extra: { target: remoteUser, reason: "hangup" },
    });

    cleanup();
  }, [roomId, remoteUser, cleanup]);

  // ====== Escalate 1:1 call to conference (keep transitional UI) ======
  const escalateToConference = useCallback(() => {
    if (stateRef.current !== CALL_STATE.ACTIVE) return;

    // Notify remote side about escalation (reason tells them to keep UI)
    sendWsMessage({
      type: "CALL_END",
      roomId: roomId,
      content: "",
      extra: { target: remoteUser, reason: "escalate" },
    });

    // Clean up WebRTC resources
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach((t) => t.stop()); localStreamRef.current = null; }
    if (durationRef.current) { clearInterval(durationRef.current); durationRef.current = null; }
    if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
    if (reconnectTimeoutRef.current) { clearTimeout(reconnectTimeoutRef.current); reconnectTimeoutRef.current = null; }
    setLocalStream(null);
    setRemoteStream(null);
    pendingIceRef.current = [];

    // Transition to ESCALATING — UI shows "Переход в конференцию..."
    stateRef.current = CALL_STATE.ESCALATING;
    setCallState(CALL_STATE.ESCALATING);

    // Fallback: if conference doesn't start within 8 seconds, clean up
    callTimeoutRef.current = setTimeout(() => {
      if (stateRef.current === CALL_STATE.ESCALATING) cleanup();
    }, 8000);
  }, [roomId, remoteUser, cleanup]);

  // ====== Finish escalation — clear transitional state ======
  const finishEscalation = useCallback(() => {
    if (stateRef.current !== CALL_STATE.ESCALATING) return;
    if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
    stateRef.current = CALL_STATE.IDLE;
    acceptingRef.current = false;
    setCallState(CALL_STATE.IDLE);
    setCallType(null);
    setRemoteUser(null);
    setRoomId(null);
    setIsAudioMuted(false);
    setIsVideoOff(false);
    setCallDuration(0);
    setIsMinimized(false);
    setIsReconnecting(false);
    incomingDataRef.current = null;
  }, []);

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
  const toggleVideo = useCallback(async () => {
    if (!localStreamRef.current) return;
    const videoTracks = localStreamRef.current.getVideoTracks();

    if (videoTracks.length === 0) {
      // No video tracks — upgrade audio call to video (add camera + renegotiate)
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        const videoTrack = videoStream.getVideoTracks()[0];
        if (!videoTrack) {
          toast("Камера недоступна", { icon: "📷" });
          return;
        }

        // Add video track to local stream
        localStreamRef.current.addTrack(videoTrack);

        // Add video track to peer connection and renegotiate
        if (pcRef.current) {
          pcRef.current.addTrack(videoTrack, localStreamRef.current);
          const offer = await pcRef.current.createOffer();
          await pcRef.current.setLocalDescription(offer);
          sendWsMessage({
            type: "CALL_REOFFER",
            roomId,
            content: "",
            extra: {
              target: remoteUser,
              callType: "video",
              sdp: JSON.stringify(offer),
            },
          });
        }

        setCallType("video");
        setIsVideoOff(false);
        // Force localStream state update so PIP re-renders
        setLocalStream(localStreamRef.current);
        toast("Камера включена", { icon: "📹" });
      } catch (err) {
        console.warn("[Call] Failed to add video:", err);
        toast("Камера недоступна", { icon: "📷" });
      }
      return;
    }

    // Video tracks exist — toggle enabled/disabled
    videoTracks.forEach((t) => { t.enabled = !t.enabled; });
    setIsVideoOff((p) => !p);
  }, [roomId, remoteUser]);

  // ====== Toggle minimize ======
  const toggleMinimize = useCallback(() => {
    setIsMinimized((p) => !p);
  }, []);

  // ====== WebSocket call message listener ======
  useEffect(() => {
    const unsub = onCallMessage((msg) => {
      const extra = msg.extra || {};
      const sender = msg.sender;
      console.log("[Call] WS received:", msg.type, "from", sender, "state=", stateRef.current);

      switch (msg.type) {
        case "CALL_OFFER": {
          if (stateRef.current !== CALL_STATE.IDLE) {
            // Already in a call — send busy
            sendWsMessage({
              type: "CALL_BUSY",
              roomId: msg.roomId,
              content: "",
              extra: { target: sender },
            });
            return;
          }
          // Incoming call
          incomingDataRef.current = {
            sender,
            roomId: msg.roomId,
            callType: extra.callType || "audio",
            sdp: extra.sdp,
          };
          setCallState(CALL_STATE.RINGING);
          setRemoteUser(sender);
          setRoomId(msg.roomId);
          setCallType(extra.callType || "audio");

          // Ringing timeout: auto-cleanup if caller's CALL_END is lost
          callTimeoutRef.current = setTimeout(() => {
            if (stateRef.current === CALL_STATE.RINGING) {
              console.log("[Call] Ringing timeout (50s), cleaning up");
              cleanup();
            }
          }, 50_000);
          break;
        }

        case "CALL_ANSWER": {
          if (stateRef.current !== CALL_STATE.CALLING || !pcRef.current) {
            console.warn("[Call] Got CALL_ANSWER but state=", stateRef.current, "pc=", !!pcRef.current);
            return;
          }
          console.log("[Call] Got CALL_ANSWER, setting ACTIVE");

          setCallState(CALL_STATE.ACTIVE);
          if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
            callTimeoutRef.current = null;
          }

          (async () => {
            try {
              const answer = JSON.parse(extra.sdp);
              await pcRef.current.setRemoteDescription(
                new RTCSessionDescription(answer),
              );
              console.log("[Call] Remote answer set, flushing", pendingIceRef.current.length, "pending ICE");

              // Flush pending ICE candidates
              for (const c of pendingIceRef.current) {
                try {
                  await pcRef.current.addIceCandidate(
                    new RTCIceCandidate(JSON.parse(c)),
                  );
                } catch {}
              }
              pendingIceRef.current = [];

              // Start duration timer
              callStartRef.current = Date.now();
              durationRef.current = setInterval(() => {
                setCallDuration(
                  Math.floor((Date.now() - callStartRef.current) / 1000),
                );
              }, 1000);
            } catch (e) {
              console.error("[Call] Failed to handle answer:", e);
              cleanup();
            }
          })();
          break;
        }

        case "ICE_CANDIDATE": {
          if (!extra.candidate) return;

          if (pcRef.current && pcRef.current.remoteDescription) {
            try {
              pcRef.current.addIceCandidate(
                new RTCIceCandidate(JSON.parse(extra.candidate)),
              );
            } catch {}
          } else {
            // Queue until remote description is set
            pendingIceRef.current.push(extra.candidate);
          }
          break;
        }

        // Mid-call SDP renegotiation (e.g. audio→video upgrade)
        case "CALL_REOFFER": {
          if (stateRef.current !== CALL_STATE.ACTIVE || !pcRef.current) return;
          console.log("[Call] Got CALL_REOFFER from", sender, "- renegotiating");
          (async () => {
            try {
              const offer = JSON.parse(extra.sdp);
              await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));
              const answer = await pcRef.current.createAnswer();
              await pcRef.current.setLocalDescription(answer);
              sendWsMessage({
                type: "CALL_REANSWER",
                roomId: msg.roomId,
                content: "",
                extra: { target: sender, sdp: JSON.stringify(answer) },
              });
              // If the remote side upgraded to video, update callType so UI shows video
              if (extra.callType === "video") {
                setCallType("video");
              }
            } catch (e) {
              console.error("[Call] Failed to handle reoffer:", e);
            }
          })();
          break;
        }

        case "CALL_REANSWER": {
          if (stateRef.current !== CALL_STATE.ACTIVE || !pcRef.current) return;
          console.log("[Call] Got CALL_REANSWER from", sender);
          (async () => {
            try {
              const answer = JSON.parse(extra.sdp);
              await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
            } catch (e) {
              console.error("[Call] Failed to handle reanswer:", e);
            }
          })();
          break;
        }

        case "CALL_END":
        case "CALL_REJECT":
        case "CALL_BUSY": {
          console.log("[Call] Received", msg.type, "from", sender, "reason=", extra.reason, "state=", stateRef.current);
          if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
            callTimeoutRef.current = null;
          }
          // Conference escalation — keep transitional UI instead of full cleanup
          if (msg.type === "CALL_END" && extra.reason === "escalate") {
            if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
            if (localStreamRef.current) { localStreamRef.current.getTracks().forEach((t) => t.stop()); localStreamRef.current = null; }
            if (durationRef.current) { clearInterval(durationRef.current); durationRef.current = null; }
            if (reconnectTimeoutRef.current) { clearTimeout(reconnectTimeoutRef.current); reconnectTimeoutRef.current = null; }
            setLocalStream(null);
            setRemoteStream(null);
            pendingIceRef.current = [];
            stateRef.current = CALL_STATE.ESCALATING;
            setCallState(CALL_STATE.ESCALATING);
            callTimeoutRef.current = setTimeout(() => {
              if (stateRef.current === CALL_STATE.ESCALATING) cleanup();
            }, 8000);
            break;
          }
          // Show toast notification for call end reason
          if (msg.type === "CALL_BUSY") {
            toast("Абонент занят", { icon: "📱" });
          } else if (msg.type === "CALL_REJECT") {
            if (stateRef.current === CALL_STATE.CALLING) toast("Звонок отклонён", { icon: "📵" });
          } else if (msg.type === "CALL_END") {
            const reason = extra.reason || "";
            if (reason === "unavailable") toast("Абонент не в сети", { icon: "📴" });
            else if (reason === "timeout") toast("Нет ответа", { icon: "⏱️" });
            else if (reason === "ice_failed") toast("Ошибка соединения", { icon: "❌" });
            else if (reason === "disconnect") toast("Соединение потеряно", { icon: "📡" });
          }
          cleanup();
          break;
        }

        default:
          break;
      }
    });

    return unsub;
  }, [cleanup]);

  const value = {
    callState,
    callType,
    remoteUser,
    roomId,
    localStream,
    remoteStream,
    isAudioMuted,
    isVideoOff,
    isMinimized,
    isReconnecting,
    callDuration,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    escalateToConference,
    finishEscalation,
    toggleAudio,
    toggleVideo,
    toggleMinimize,
    CALL_STATE,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within CallProvider");
  return ctx;
}

export { CallProvider, useCall };
