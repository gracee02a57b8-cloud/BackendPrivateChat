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
        className="mb-2 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-bgAccent transition hover:bg-LightShade/10 dark:text-bgAccent-dark"
      >
        <RiAddLine className="text-lg" />
        Создать группу
      </button>

      {!groups?.length ? (
        <ShortTextMessage>
          Нет групп. Создай или вступи в группу!
        </ShortTextMessage>
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
