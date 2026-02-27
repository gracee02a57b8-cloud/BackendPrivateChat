import ShortTextMessage from "../../components/ShortTextMessage";
import { useConversations } from "./useConversations";
import { useUi } from "../../contexts/UiContext";
import Loader from "../../components/Loader";
import UserItem from "../../components/UserItem";
import GroupItem from "./GroupItem";

function UserList() {
  const { conversations, isPending, error } = useConversations();
  const { closeSidebar } = useUi();

  if (isPending)
    return (
      <ShortTextMessage opacity={100}>
        <Loader size="medium" text="Loading chats" />
      </ShortTextMessage>
    );

  if (error) return <ShortTextMessage>⚠️ {error.message}</ShortTextMessage>;

  if (!conversations?.length)
    return (
      <ShortTextMessage>
        Нет чатов. Найди собеседника через поиск!
      </ShortTextMessage>
    );

  if (conversations)
    return conversations.map((conv) => {
      // Групповой чат
      if (conv?.isGroup) {
        return (
          <GroupItem
            key={conv.id}
            group={{
              id: conv.id,
              name: conv.friendInfo?.fullname || "Группа",
              description: conv.friendInfo?.bio || "",
              avatarUrl: conv.friendInfo?.avatar_url || "",
              members: conv.members || [],
            }}
            handler={closeSidebar}
          />
        );
      }

      // Приватный чат
      const id = conv?.friendInfo?.id;
      if (!id) return null;

      const avatar_url = conv?.friendInfo?.avatar_url;
      const fullname = conv?.friendInfo?.fullname;
      const lastMessage = conv?.last_message?.content;

      return (
        <UserItem
          key={id}
          id={id}
          avatar={avatar_url}
          name={fullname}
          subtext={lastMessage}
          handler={closeSidebar}
        />
      );
    });
}

export default UserList;
