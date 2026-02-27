import { useContacts } from "./useContacts";
import { useUi } from "../../contexts/UiContext";
import Loader from "../../components/Loader";
import UserItem from "../../components/UserItem";
import ShortTextMessage from "../../components/ShortTextMessage";

function ContactList() {
  const { contacts, isPending, error } = useContacts();
  const { closeSidebar } = useUi();

  if (isPending)
    return (
      <ShortTextMessage opacity={100}>
        <Loader size="medium" text="Загрузка контактов" />
      </ShortTextMessage>
    );

  if (error) return <ShortTextMessage>⚠️ {error.message}</ShortTextMessage>;

  if (!contacts?.length)
    return (
      <ShortTextMessage>
        Нет контактов. Добавь друзей через поиск!
      </ShortTextMessage>
    );

  return contacts.map((contact) => (
    <UserItem
      key={contact.id}
      id={contact.id}
      avatar={contact.avatar_url}
      name={contact.fullname}
      subtext={contact.tag || `@${contact.username}`}
      handler={closeSidebar}
    />
  ));
}

export default ContactList;
