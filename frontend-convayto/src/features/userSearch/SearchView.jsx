import { useSearchedUsers } from "./useSearchedUsers";
import Loader from "../../components/Loader";
import UserItem from "../../components/UserItem";
import GroupItem from "../sideBar/GroupItem";
import { useUi } from "../../contexts/UiContext";
import ShortTextMessage from "../../components/ShortTextMessage";

function SearchView() {
  const { users, groups, isShortQuery, isLoading, error } = useSearchedUsers();
  const { closeSearchView, closeSidebar } = useUi();

  if (isShortQuery) {
    return <ShortTextMessage>Поиск людей и групп</ShortTextMessage>;
  }

  if (isLoading) {
    return (
      <ShortTextMessage opacity={100}>
        <Loader text="Поиск..." size="medium" />
      </ShortTextMessage>
    );
  }

  if (error) {
    return <ShortTextMessage>⚠️ Что-то пошло не так!</ShortTextMessage>;
  }

  const hasUsers = users?.length > 0;
  const hasGroups = groups?.length > 0;

  if (!hasUsers && !hasGroups) {
    return <ShortTextMessage>Ничего не найдено</ShortTextMessage>;
  }

  return (
    <div className="fadeIn p-2">
      {/* Users section */}
      {hasUsers && (
        <>
          <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-textPrimary/40 dark:text-textPrimary-dark/40">
            Люди
          </p>
          {users.map(({ id, avatar_url, fullname, username }) => (
            <UserItem
              key={id}
              id={id}
              avatar={avatar_url}
              name={fullname}
              subtext={username}
              handler={() => closeSearchView({ back: false })}
              shouldReplace={true}
            />
          ))}
        </>
      )}

      {/* Groups section */}
      {hasGroups && (
        <>
          <p className="mb-1 mt-3 px-2 text-xs font-semibold uppercase tracking-wider text-textPrimary/40 dark:text-textPrimary-dark/40">
            Группы
          </p>
          {groups.map((group) => (
            <GroupItem
              key={group.id}
              group={group}
              handler={() => {
                closeSearchView({ back: false });
                closeSidebar();
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}

export default SearchView;
