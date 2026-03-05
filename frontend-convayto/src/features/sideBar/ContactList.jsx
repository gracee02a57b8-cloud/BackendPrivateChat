import { useContacts } from "./useContacts";
import { useUi } from "../../contexts/UiContext";
import Loader from "../../components/Loader";
import UserItem from "../../components/UserItem";
import ShortTextMessage from "../../components/ShortTextMessage";
import { useOnlineUsers } from "../../hooks/useOnlineUsers";

function ContactList() {
  const { contacts, isPending, error } = useContacts();
  const { closeSidebar } = useUi();
  const onlineUsers = useOnlineUsers();

  if (isPending)
    return (
      <ShortTextMessage opacity={100}>
        <Loader size="medium" text="Загрузка контактов" />
      </ShortTextMessage>
    );

  if (error) return <ShortTextMessage>⚠️ {error.message}</ShortTextMessage>;

  if (!contacts?.length)
    return (
      <div className="empty-state mt-8 flex flex-col items-center gap-3 px-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-LightShade/[0.05] text-3xl">
          📇
        </span>
        <p className="text-sm opacity-40">Нет контактов. Добавь друзей через поиск!</p>
      </div>
    );

  return contacts.map((contact) => (
    <UserItem
      key={contact.id}
      id={contact.id}
      avatar={contact.avatar_url}
      name={contact.fullname}
      subtext={
        onlineUsers.has(contact.username || contact.id)
          ? "в сети"
          : contact.tag || `@${contact.username}`
      }
      handler={closeSidebar}
      online={onlineUsers.has(contact.username || contact.id)}
    />
  ));
}

export default ContactList;
