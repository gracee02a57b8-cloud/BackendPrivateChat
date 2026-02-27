import Messages from "./Messages";
import MessageTopBar from "./MessageTopBar";
import MessageInputBar from "./MessageInputBar";
import ForwardMessageModal from "../../components/ForwardMessageModal";
import { useState, useCallback } from "react";
import { RiShareForwardLine, RiCloseLine, RiDeleteBinLine } from "react-icons/ri";
import { sendWsMessage } from "../../services/wsService";
import { useQueryClient } from "@tanstack/react-query";
import useConvInfo from "./useConvInfo";
import toast from "react-hot-toast";

function MessageView() {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [forwardMessages, setForwardMessages] = useState([]);
  const [showForward, setShowForward] = useState(false);
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

  return (
    <div className="relative col-span-2 grid h-screen-safe w-full grid-cols-1 grid-rows-[auto_1fr_auto] overflow-hidden md:col-span-1">
      <MessageTopBar />

      <Messages
        selectionMode={selectionMode}
        selectedMessages={selectedMessages}
        toggleSelectMessage={toggleSelectMessage}
        enterSelectionMode={enterSelectionMode}
        onReply={setReplyTo}
        onForward={handleForwardSingle}
        onDeleteLocal={handleDeleteLocal}
        onDeleteForAll={handleDeleteForAll}
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
    </div>
  );
}

export default MessageView;
