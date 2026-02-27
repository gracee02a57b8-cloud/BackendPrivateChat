import { useNavigate, useParams } from "react-router-dom";
import { useEnterKeyPress } from "../utils/useEnterKeyPress";
import { getRandomAvatar } from "../utils/avatarUtils";

function UserItem({
  id,
  name,
  avatar,
  subtext,
  handler,
  shouldReplace = false,
}) {
  const { userId: currentFriendId } = useParams();
  const isActiveUser = currentFriendId === id;

  const navigate = useNavigate();

  function handleClick() {
    handler();
    navigate(`/chat/${id}`, { replace: shouldReplace });
  }

  const handleKeyDown = useEnterKeyPress(handleClick);

  return (
    <div
      className={`${
        isActiveUser
          ? "pointer-events-none bg-gradient-to-r text-textPrimary-dark sm:from-bgAccentDim sm:to-bgAccent dark:sm:from-bgAccentDim-dark dark:sm:to-bgAccent-dark"
          : "hover:bg-LightShade/20"
      } flex cursor-pointer select-none items-center gap-2 rounded-lg p-2 `}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full">
        <img
          src={avatar || getRandomAvatar(name || id)}
          alt={name}
          className="pointer-events-none h-full w-full object-cover"
        />
      </span>

      <span className="flex flex-col overflow-hidden ">
        <span className="truncate font-bold">{name}</span>

        <span className="truncate text-sm opacity-70">{subtext}</span>
      </span>
    </div>
  );
}

export default UserItem;
