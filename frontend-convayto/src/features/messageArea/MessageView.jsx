import Messages from "./Messages";
import MessageTopBar from "./MessageTopBar";
import MessageInputBar from "./MessageInputBar";
import ForwardMessageModal from "../../components/ForwardMessageModal";
import { useState, useCallback, useEffect } from "react";
import { RiShareForwardLine, RiCloseLine, RiDeleteBinLine, RiPushpinFill, RiCloseFill } from "react-icons/ri";
import { sendWsMessage } from "../../services/wsService";
import { apiFetch } from "../../services/apiHelper";
import { useQueryClient } from "@tanstack/react-query";
import useConvInfo from "./useConvInfo";
import toast from "react-hot-toast";
import { getPinnedMessages } from "./apiMessage";

function MessageView() {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [forwardMessages, setForwardMessages] = useState([]);
  const [showForward, setShowForward] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [readersModal, setReadersModal] = useState(null); // { messageId, readers }
  const { convInfo } = useConvInfo();
  const queryClient = useQueryClient();
  const friendUserId = convInfo?.friendInfo?.id;

  const toggleSelectMessage = useCallback((message) => {
    setSelectedMessages((prev) => {
      const exists = prev.find((m) => m.id === message.id);
      if (exists) return prev.filter((m) => m.id !== message.id);
      return [...prev, message];
    });
  }, []);

  const enterSelectionMode = useCallback((message) => {
    setSelectionMode(true);
    setSelectedMessages([message]);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedMessages([]);
  }, []);

  const handleForwardSingle = useCallback((message) => {
    setForwardMessages([message]);
    setShowForward(true);
  }, []);

  const handleForwardSelected = useCallback(() => {
    if (selectedMessages.length === 0) return;
    setForwardMessages(selectedMessages);
    setShowForward(true);
  }, [selectedMessages]);

  const handleCloseForward = useCallback(() => {
    setShowForward(false);
    setForwardMessages([]);
    exitSelectionMode();
  }, [exitSelectionMode]);

  const handleDeleteLocal = useCallback(
    (message) => {
      // Remove message from local cache only
      queryClient.setQueryData(["friend", friendUserId], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) =>
            page.filter((m) => m.id !== message.id),
          ),
        };
      });
      toast.success("Сообщение удалено");
    },
    [queryClient, friendUserId],
  );

  const handleDeleteForAll = useCallback(
    (message) => {
      const roomId = convInfo?.id;
      if (!roomId) return;
      sendWsMessage({
        type: "DELETE",
        roomId,
        id: message.id,
      });
      // Optimistically remove
      queryClient.setQueryData(["friend", friendUserId], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) =>
            page.filter((m) => m.id !== message.id),
          ),
        };
      });
      toast.success("Сообщение удалено для всех");
    },
    [queryClient, friendUserId, convInfo],
  );

  const handleDeleteSelected = useCallback(() => {
    selectedMessages.forEach((msg) => handleDeleteLocal(msg));
    exitSelectionMode();
  }, [selectedMessages, handleDeleteLocal, exitSelectionMode]);

  // Fetch pinned messages when room changes
  useEffect(() => {
    const roomId = convInfo?.id;
    if (!roomId) { setPinnedMessages([]); return; }
    getPinnedMessages(roomId)
      .then((msgs) => setPinnedMessages(msgs || []))
      .catch(() => setPinnedMessages([]));
  }, [convInfo?.id]);

  // Listen for pin/unpin realtime updates in cache and sync pinned bar
  useEffect(() => {
    const roomId = convInfo?.id;
    if (!roomId) return;
    // Subscribe to cache changes to detect pin/unpin
    const unsub = queryClient.getQueryCache().subscribe((event) => {
      if (event?.query?.queryKey?.[0] !== "friend" || event?.query?.queryKey?.[1] !== friendUserId) return;
      // Rebuild pinned list from cache
      const data = queryClient.getQueryData(["friend", friendUserId]);
      if (!data?.pages) return;
      const allPinned = [];
      for (const page of data.pages) {
        for (const m of page) {
          if (m.pinned) allPinned.push(m);
        }
      }
      setPinnedMessages(allPinned);
    });
    return () => unsub?.();
  }, [convInfo?.id, friendUserId, queryClient]);

  const handlePin = useCallback(
    (message) => {
      const roomId = convInfo?.id;
      if (!roomId) return;
      sendWsMessage({ type: "PIN", roomId, id: message.id });
      // Optimistic update
      queryClient.setQueryData(["friend", friendUserId], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) =>
            page.map((m) =>
              m.id === message.id ? { ...m, pinned: true, pinnedBy: localStorage.getItem("username") } : m,
            ),
          ),
        };
      });
      setPinnedMessages((prev) => [...prev.filter((m) => m.id !== message.id), { ...message, pinned: true }]);
      toast.success("Сообщение закреплено");
    },
    [convInfo, queryClient, friendUserId],
  );

  const handleUnpin = useCallback(
    (message) => {
      const roomId = convInfo?.id;
      if (!roomId) return;
      sendWsMessage({ type: "UNPIN", roomId, id: message.id });
      // Optimistic update
      queryClient.setQueryData(["friend", friendUserId], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) =>
            page.map((m) =>
              m.id === message.id ? { ...m, pinned: false, pinnedBy: null } : m,
            ),
          ),
        };
      });
      setPinnedMessages((prev) => prev.filter((m) => m.id !== message.id));
      toast.success("Сообщение откреплено");
    },
    [convInfo, queryClient, friendUserId],
  );

  const lastPinned = pinnedMessages.length > 0 ? pinnedMessages[pinnedMessages.length - 1] : null;

  // ── Reactions via WebSocket ──
  const handleReaction = useCallback(
    (message, emoji) => {
      const roomId = convInfo?.id;
      if (!roomId || !message?.id) return;
      const myUsername = localStorage.getItem("username");

      // Check if already reacted with this emoji → toggle
      const existingReaction = message?.reactions?.find(
        (r) => r.emoji === emoji && r.users?.includes(myUsername)
      );
      const type = existingReaction ? "REACTION_REMOVE" : "REACTION";

      sendWsMessage({
        type,
        roomId,
        id: message.id,
        extra: { emoji },
      });

      // Optimistic update
      queryClient.setQueryData(["friend", friendUserId], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) =>
            page.map((m) => {
              if (m.id !== message.id) return m;
              let reactions = [...(m.reactions || [])];
              if (type === "REACTION") {
                const idx = reactions.findIndex((r) => r.emoji === emoji);
                if (idx >= 0) {
                  reactions[idx] = {
                    ...reactions[idx],
                    users: [...(reactions[idx].users || []), myUsername],
                    count: (reactions[idx].count || 0) + 1,
                  };
                } else {
                  reactions.push({ emoji, users: [myUsername], count: 1 });
                }
              } else {
                const idx = reactions.findIndex((r) => r.emoji === emoji);
                if (idx >= 0) {
                  const newUsers = (reactions[idx].users || []).filter((u) => u !== myUsername);
                  if (newUsers.length === 0) {
                    reactions.splice(idx, 1);
                  } else {
                    reactions[idx] = { ...reactions[idx], users: newUsers, count: newUsers.length };
                  }
                }
              }
              return { ...m, reactions };
            })
          ),
        };
      });
    },
    [convInfo, queryClient, friendUserId]
  );

  // ── Poll vote via REST ──
  const handleVotePoll = useCallback(
    async (pollId, optionId) => {
      try {
        const result = await apiFetch(`/api/polls/${pollId}/vote`, {
          method: "POST",
          body: JSON.stringify({ optionId }),
        });
        if (result) {
          // Update poll data in cache
          queryClient.setQueryData(["friend", friendUserId], (old) => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((page) =>
                page.map((m) => {
                  if (m.pollData?.pollId === pollId) {
                    return { ...m, pollData: result };
                  }
                  return m;
                })
              ),
            };
          });
        }
      } catch (err) {
        toast.error(err.message || "Ошибка голосования");
      }
    },
    [queryClient, friendUserId]
  );

  // ── Read receipts (group messages) ──
  const handleShowReaders = useCallback(
    async (message) => {
      const roomId = convInfo?.id;
      if (!roomId || !message?.id) return;
      try {
        const data = await apiFetch(`/api/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(message.id)}/readers`);
        setReadersModal({ messageId: message.id, readers: data?.readers || [], count: data?.count || 0 });
      } catch {
        toast.error("Не удалось загрузить");
      }
    },
    [convInfo]
  );

  return (
    <div className={`relative col-span-2 grid h-screen-safe w-full grid-cols-1 overflow-hidden md:col-span-1 ${lastPinned ? 'grid-rows-[auto_auto_1fr_auto]' : 'grid-rows-[auto_1fr_auto]'}`}>
      <MessageTopBar />

      {/* Pinned message bar */}
      {lastPinned && (
        <div className="flex items-center gap-2 border-b border-LightShade/20 bg-bgPrimary/80 px-4 py-2 backdrop-blur-sm dark:bg-bgPrimary-dark/80">
          <RiPushpinFill className="flex-shrink-0 text-base text-bgAccent dark:text-bgAccent-dark" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-bgAccent dark:text-bgAccent-dark">
              Закреплённое сообщение
            </p>
            <p className="truncate text-sm text-textPrimary dark:text-textPrimary-dark">
              {lastPinned.content || "📎 Вложение"}
            </p>
          </div>
          <button
            onClick={() => handleUnpin(lastPinned)}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition hover:bg-LightShade/20"
            title="Открепить"
          >
            <RiCloseFill className="text-base opacity-60" />
          </button>
        </div>
      )}

      <Messages
        selectionMode={selectionMode}
        selectedMessages={selectedMessages}
        toggleSelectMessage={toggleSelectMessage}
        enterSelectionMode={enterSelectionMode}
        onReply={setReplyTo}
        onForward={handleForwardSingle}
        onPin={handlePin}
        onUnpin={handleUnpin}
        onDeleteLocal={handleDeleteLocal}
        onDeleteForAll={handleDeleteForAll}
        onReaction={handleReaction}
        onVotePoll={handleVotePoll}
        onShowReaders={handleShowReaders}
      />

      {selectionMode ? (
        <div className="border-t border-LightShade/20 bg-bgPrimary px-4 py-3 dark:bg-bgPrimary-dark">
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <span className="text-sm font-medium">
              Выбрано: {selectedMessages.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleForwardSelected}
                disabled={selectedMessages.length === 0}
                className="flex items-center gap-1.5 rounded-lg bg-bgAccent px-4 py-2 text-sm font-medium text-textPrimary-dark transition hover:bg-bgAccentDim active:scale-95 disabled:opacity-50 dark:bg-bgAccent-dark dark:hover:bg-bgAccentDim-dark"
              >
                <RiShareForwardLine />
                Переслать
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={selectedMessages.length === 0}
                className="flex items-center gap-1.5 rounded-lg bg-red-500/80 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600 active:scale-95 disabled:opacity-50"
              >
                <RiDeleteBinLine />
                Удалить
              </button>
              <button
                onClick={exitSelectionMode}
                className="flex h-9 w-9 items-center justify-center rounded-full text-lg transition hover:bg-LightShade/20"
              >
                <RiCloseLine />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <MessageInputBar replyTo={replyTo} setReplyTo={setReplyTo} />
      )}

      <ForwardMessageModal
        isOpen={showForward}
        onClose={handleCloseForward}
        messages={forwardMessages}
      />

      {/* Readers modal */}
      {readersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setReadersModal(null)}>
          <div
            className="mx-4 w-full max-w-xs rounded-2xl bg-bgPrimary p-5 shadow-2xl dark:bg-bgPrimary-dark"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold">
                Прочитали ({readersModal.count})
              </h3>
              <button
                onClick={() => setReadersModal(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-LightShade/20"
              >
                <RiCloseLine className="text-lg" />
              </button>
            </div>
            {readersModal.readers.length === 0 ? (
              <p className="text-sm opacity-60">Никто ещё не прочитал</p>
            ) : (
              <ul className="max-h-60 space-y-2 overflow-y-auto">
                {readersModal.readers.map((r) => (
                  <li key={r.username} className="flex items-center gap-2 text-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-bgAccent/20 text-xs font-bold uppercase">
                      {r.username?.charAt(0)}
                    </div>
                    <span className="font-medium">{r.username}</span>
                    {r.readAt && (
                      <span className="ml-auto text-xs opacity-50">
                        {new Date(r.readAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MessageView;
