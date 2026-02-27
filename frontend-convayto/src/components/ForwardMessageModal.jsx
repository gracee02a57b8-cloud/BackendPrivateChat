// ==========================================
// ForwardMessageModal — select a chat to forward a message to
// ==========================================
import { useState, useEffect } from "react";
import { RiCloseFill, RiShareForwardLine } from "react-icons/ri";
import { apiFetch } from "../services/apiHelper";
import { sendWsMessage } from "../services/wsService";
import { v4 as uuid } from "uuid";
import toast from "react-hot-toast";

function ForwardMessageModal({ isOpen, onClose, message }) {
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const myUsername = localStorage.getItem("username");

  // Fetch all rooms when opened
  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
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

  function handleForward(room) {
    if (!message?.content) {
      toast.error("Нет сообщения для пересылки");
      return;
    }

    const forwarded = sendWsMessage({
      type: "CHAT",
      roomId: room.id,
      content: `↪ Переслано от ${message.sender_id || "?"}: ${message.content}`,
      id: uuid(),
    });

    if (forwarded) {
      toast.success(`Переслано в ${room.name}`);
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
            <h2 className="text-lg font-semibold">Переслать сообщение</h2>
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
          <div className="mb-3 rounded-lg bg-LightShade/10 px-3 py-2 text-sm dark:bg-LightShade/5">
            <p className="truncate text-textPrimary/70 dark:text-textPrimary-dark/70">
              {message?.content || "..."}
            </p>
          </div>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск чата..."
            className="mb-3 w-full rounded-lg border border-LightShade/30 bg-transparent px-3 py-2 outline-none focus:border-bgAccent dark:border-LightShade/20 dark:focus:border-bgAccent-dark"
          />

          {/* Room list */}
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
              filtered.map((room) => (
                <button
                  key={room.id}
                  onClick={() => handleForward(room)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-LightShade/10"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-purple-500 text-sm font-bold text-white">
                    {room.type === "ROOM" ? "G" : room.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{room.name}</p>
                    <p className="text-xs text-textPrimary/50 dark:text-textPrimary-dark/50">
                      {room.type === "ROOM" ? "Группа" : "Личный чат"}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForwardMessageModal;
