import { useGroups } from "./useGroups";
import { useUi } from "../../contexts/UiContext";
import Loader from "../../components/Loader";
import ShortTextMessage from "../../components/ShortTextMessage";
import GroupItem from "./GroupItem";
import { useState } from "react";
import { RiAddLine } from "react-icons/ri";
import CreateGroupModal from "../../components/CreateGroupModal";

function GroupList() {
  const { groups, isPending, error } = useGroups();
  const { closeSidebar } = useUi();
  const [showCreate, setShowCreate] = useState(false);

  if (isPending)
    return (
      <ShortTextMessage opacity={100}>
        <Loader size="medium" text="Загрузка групп" />
      </ShortTextMessage>
    );

  if (error) return <ShortTextMessage>⚠️ {error.message}</ShortTextMessage>;

  return (
    <>
      {/* Create group button */}
      <button
        onClick={() => setShowCreate(true)}
        className="create-btn-premium mb-3 flex w-full items-center gap-3 rounded-xl border border-dashed border-bgAccent/20 px-3 py-3 text-sm font-medium text-bgAccent dark:border-bgAccent-dark/20 dark:text-bgAccent-dark"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-bgAccent/10 dark:bg-bgAccent-dark/10">
          <RiAddLine className="text-lg" />
        </span>
        <span>Создать группу</span>
      </button>

      {!groups?.length ? (
        <div className="empty-state mt-8 flex flex-col items-center gap-3 px-4 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-LightShade/[0.05] text-3xl">
            👥
          </span>
          <p className="text-sm opacity-40">Нет групп. Создай или вступи в группу!</p>
        </div>
      ) : (
        groups.map((group) => (
          <GroupItem key={group.id} group={group} handler={closeSidebar} />
        ))
      )}

      <CreateGroupModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
      />
    </>
  );
}

export default GroupList;
