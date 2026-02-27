import { useGroups } from "./useGroups";
import { useUi } from "../../contexts/UiContext";
import Loader from "../../components/Loader";
import ShortTextMessage from "../../components/ShortTextMessage";
import GroupItem from "./GroupItem";

function GroupList() {
  const { groups, isPending, error } = useGroups();
  const { closeSidebar } = useUi();

  if (isPending)
    return (
      <ShortTextMessage opacity={100}>
        <Loader size="medium" text="Загрузка групп" />
      </ShortTextMessage>
    );

  if (error) return <ShortTextMessage>⚠️ {error.message}</ShortTextMessage>;

  if (!groups?.length)
    return (
      <ShortTextMessage>
        Нет групп. Создай или вступи в группу!
      </ShortTextMessage>
    );

  return groups.map((group) => (
    <GroupItem
      key={group.id}
      group={group}
      handler={closeSidebar}
    />
  ));
}

export default GroupList;
