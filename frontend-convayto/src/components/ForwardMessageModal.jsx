// ==========================================
// ForwardMessageModal — multi-message + multi-recipient forwarding
// ==========================================
import { useState, useEffect, useCallback } from "react";
import { RiCloseFill, RiShareForwardLine, RiCheckboxCircleLine, RiCheckboxBlankCircleLine } from "react-icons/ri";
import { apiFetch } from "../services/apiHelper";
import { sendWsMessage } from "../services/wsService";
import { v4 as uuid } from "uuid";
import toast from "react-hot-toast";
import { getRandomAvatar } from "../utils/avatarUtils";

function ForwardMessageModal({ isOpen, onClose, messages = [] }) {
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedRooms, setSelectedRooms] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const myUsername = localStorage.getItem("username");

  // Fetch all rooms when opened
  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    setSelectedRooms([]);
    setSearch("");
    apiFetch("/api/rooms")
      .then((data) => {
        if (Array.isArray(data)) {
          setRooms(
            data.map((r) => ({
              id: r.id,
              name:
                r.type === "ROOM"
                  ? r.name || "Группа"
                  : r.members?.find((m) => m !== myUsername) || r.id,
              type: r.type,
              members: r.members || [],
            })),
          );
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [isOpen, myUsername]);

  const toggleRoom = useCallback((room) => {
    setSelectedRooms((prev) => {
      const exists = prev.find((r) => r.id === room.id);
      if (exists) return prev.filter((r) => r.id !== room.id);
      return [...prev, room];
    });
  }, []);

  function handleSend() {
    if (selectedRooms.length === 0 || messages.length === 0) return;
    setIsSending(true);

    let successCount = 0;
    for (const room of selectedRooms) {
      for (const msg of messages) {
        const content = msg?.content || msg?.fileName || "📎 Вложение";
        const ok = sendWsMessage({
          type: "CHAT",
          roomId: room.id,
          content: `↪ Переслано от ${msg.sender_id || "?"}: ${content}`,
          id: uuid(),
        });
        if (ok) successCount++;
      }
    }

    setIsSending(false);

    if (successCount > 0) {
      const roomNames = selectedRooms.map((r) => r.name).join(", ");
      toast.success(
        messages.length === 1
          ? `Переслано в ${roomNames}`
          : `${messages.length} сообщ. переслано в ${roomNames}`,
      );
      onClose();
    } else {
      toast.error("Не удалось переслать. Проверьте подключение.");
    }
  }

  const filtered = rooms.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()),
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-bgPrimary shadow-2xl dark:bg-bgPrimary-dark">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-LightShade/20 px-4 py-3">
          <div className="flex items-center gap-2">
            <RiShareForwardLine className="text-xl text-bgAccent dark:text-bgAccent-dark" />
            <h2 className="text-lg font-semibold">
              Переслать {messages.length > 1 ? `(${messages.length})` : "сообщение"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-LightShade/20"
          >
            <RiCloseFill className="text-2xl" />
          </button>
        </div>

        <div className="p-4">
          {/* Message preview */}
          <div className="mb-3 max-h-20 overflow-y-auto rounded-lg bg-LightShade/10 px-3 py-2 text-sm dark:bg-LightShade/5">
            {messages.length === 1 ? (
              <p className="truncate text-textPrimary/70 dark:text-textPrimary-dark/70">
                {messages[0]?.content || "📎 Вложение"}
              </p>
            ) : (
              <p className="text-textPrimary/70 dark:text-textPrimary-dark/70">
                📨 {messages.length} сообщений для пересылки
              </p>
            )}
          </div>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск чата..."
            className="mb-3 w-full rounded-lg border border-LightShade/30 bg-transparent px-3 py-2 outline-none focus:border-bgAccent dark:border-LightShade/20 dark:focus:border-bgAccent-dark"
          />

          {/* Room list — checkboxes for multi-select */}
          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <p className="py-4 text-center text-sm text-textPrimary/50 dark:text-textPrimary-dark/50">
                Загрузка...
              </p>
            ) : filtered.length === 0 ? (
              <p className="py-4 text-center text-sm text-textPrimary/50 dark:text-textPrimary-dark/50">
                Нет чатов
              </p>
            ) : (
              filtered.map((room) => {
                const isSelected = selectedRooms.some((r) => r.id === room.id);
                return (
                  <button
                    key={room.id}
                    onClick={() => toggleRoom(room)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-LightShade/10 ${
                      isSelected ? "bg-bgAccent/10 dark:bg-bgAccent-dark/10" : ""
                    }`}
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full">
                      <img src={getRandomAvatar(room.name || room.id)} alt={room.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{room.name}</p>
                      <p className="text-xs text-textPrimary/50 dark:text-textPrimary-dark/50">
                        {room.type === "ROOM" ? "Группа" : "Личный чат"}
                      </p>
                    </div>
                    <span className="text-xl">
                      {isSelected ? (
                        <RiCheckboxCircleLine className="text-bgAccent dark:text-bgAccent-dark" />
                      ) : (
                        <RiCheckboxBlankCircleLine className="opacity-30" />
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Send button */}
          {selectedRooms.length > 0 && (
            <button
              onClick={handleSend}
              disabled={isSending}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-bgAccent py-2.5 text-sm font-semibold text-textPrimary-dark transition hover:bg-bgAccentDim active:scale-[0.98] disabled:opacity-50 dark:bg-bgAccent-dark dark:hover:bg-bgAccentDim-dark"
            >
              <RiShareForwardLine />
              Отправить ({selectedRooms.length})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ForwardMessageModal;
