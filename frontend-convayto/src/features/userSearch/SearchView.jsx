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
    return (
      <div className="empty-state mt-12 flex flex-col items-center gap-3 px-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-LightShade/[0.05] text-2xl">
          🔍
        </span>
        <p className="text-sm opacity-35">Поиск людей и групп</p>
      </div>
    );
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
    return (
      <div className="empty-state mt-12 flex flex-col items-center gap-3 px-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-LightShade/[0.05] text-2xl">
          🙅
        </span>
        <p className="text-sm opacity-35">Ничего не найдено</p>
      </div>
    );
  }

  return (
    <div className="fadeIn px-2 pt-2 pb-4">
      {/* Users section */}
      {hasUsers && (
        <>
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-bgAccent/60 dark:text-bgAccent-dark/60">
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
          <p className="mb-2 mt-4 px-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-bgAccent/60 dark:text-bgAccent-dark/60">
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
