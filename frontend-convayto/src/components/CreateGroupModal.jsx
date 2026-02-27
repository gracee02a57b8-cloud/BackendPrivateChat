// ==========================================
// CreateGroupModal — create a new group chat
// ==========================================
import { useState } from "react";
import { RiCloseFill, RiGroupLine } from "react-icons/ri";
import { apiFetch } from "../services/apiHelper";
import { useContacts } from "../features/sideBar/useContacts";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

function CreateGroupModal({ isOpen, onClose }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const { contacts } = useContacts();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  function toggleMember(username) {
    setSelectedMembers((prev) =>
      prev.includes(username)
        ? prev.filter((u) => u !== username)
        : [...prev, username],
    );
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Введите название группы");
      return;
    }

    setIsLoading(true);
    try {
      const room = await apiFetch("/api/rooms/create", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          type: "ROOM",
          memberUsernames: selectedMembers,
        }),
      });

      // Invalidate queries to refresh sidebar
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });

      toast.success("Группа создана!");
      onClose();

      // Navigate to the new group
      if (room?.id) {
        navigate(`/chat/room/${encodeURIComponent(room.id)}`);
      }

      // Reset form
      setName("");
      setDescription("");
      setSelectedMembers([]);
    } catch (err) {
      toast.error(err.message || "Не удалось создать группу");
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-bgPrimary shadow-2xl dark:bg-bgPrimary-dark">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-LightShade/20 px-4 py-3">
          <div className="flex items-center gap-2">
            <RiGroupLine className="text-xl text-bgAccent dark:text-bgAccent-dark" />
            <h2 className="text-lg font-semibold">Новая группа</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-LightShade/20"
          >
            <RiCloseFill className="text-2xl" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-4">
          {/* Group name */}
          <label className="mb-1 block text-sm font-medium text-textPrimary/70 dark:text-textPrimary-dark/70">
            Название группы *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например: Рабочий чат"
            maxLength={50}
            className="mb-3 w-full rounded-lg border border-LightShade/30 bg-transparent px-3 py-2 outline-none focus:border-bgAccent dark:border-LightShade/20 dark:focus:border-bgAccent-dark"
          />

          {/* Description */}
          <label className="mb-1 block text-sm font-medium text-textPrimary/70 dark:text-textPrimary-dark/70">
            Описание
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="О чём группа?"
            maxLength={200}
            className="mb-4 w-full rounded-lg border border-LightShade/30 bg-transparent px-3 py-2 outline-none focus:border-bgAccent dark:border-LightShade/20 dark:focus:border-bgAccent-dark"
          />

          {/* Member selection */}
          <label className="mb-2 block text-sm font-medium text-textPrimary/70 dark:text-textPrimary-dark/70">
            Участники ({selectedMembers.length})
          </label>
          <div className="mb-4 max-h-48 overflow-y-auto rounded-lg border border-LightShade/20 p-1">
            {contacts?.length > 0 ? (
              contacts.map((contact) => (
                <label
                  key={contact.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-LightShade/10"
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(contact.username)}
                    onChange={() => toggleMember(contact.username)}
                    className="h-4 w-4 rounded accent-bgAccent"
                  />
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-purple-500 text-xs font-bold text-white">
                      {contact.fullname?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{contact.fullname}</p>
                      <p className="text-xs text-textPrimary/50 dark:text-textPrimary-dark/50">
                        @{contact.username}
                      </p>
                    </div>
                  </div>
                </label>
              ))
            ) : (
              <p className="py-4 text-center text-sm text-textPrimary/50 dark:text-textPrimary-dark/50">
                Нет контактов. Добавьте друзей через поиск.
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading || !name.trim()}
            className="w-full rounded-xl bg-bgAccent py-2.5 font-semibold text-textPrimary-dark transition hover:bg-bgAccentDim active:scale-[0.98] disabled:opacity-60 dark:bg-bgAccent-dark dark:hover:bg-bgAccentDim-dark"
          >
            {isLoading ? "Создание..." : "Создать группу"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default CreateGroupModal;
