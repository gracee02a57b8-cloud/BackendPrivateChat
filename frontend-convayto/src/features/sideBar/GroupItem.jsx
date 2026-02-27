import { useNavigate, useParams } from "react-router-dom";
import { useEnterKeyPress } from "../../utils/useEnterKeyPress";
import { getRandomAvatar } from "../../utils/avatarUtils";

function GroupItem({ group, handler }) {
  const { roomId: currentRoomId } = useParams();
  const isActive = currentRoomId === group.id;

  const navigate = useNavigate();

  function handleClick() {
    handler();
    navigate(`/chat/room/${encodeURIComponent(group.id)}`);
  }

  const handleKeyDown = useEnterKeyPress(handleClick);

  const membersText = `${group.members?.length || 0} участник${
    (group.members?.length || 0) === 1
      ? ""
      : (group.members?.length || 0) < 5
        ? "а"
        : "ов"
  }`;

  return (
    <div
      className={`${
        isActive
          ? "pointer-events-none bg-gradient-to-r text-textPrimary-dark sm:from-bgAccentDim sm:to-bgAccent dark:sm:from-bgAccentDim-dark dark:sm:to-bgAccent-dark"
          : "hover:bg-LightShade/20"
      } flex cursor-pointer select-none items-center gap-2 rounded-lg p-2`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full">
        <img
          src={group.avatarUrl || getRandomAvatar(group.name || group.id)}
          alt={group.name}
          className="pointer-events-none h-full w-full object-cover"
        />
      </span>

      <span className="flex flex-col overflow-hidden">
        <span className="truncate font-bold">{group.name}</span>
        <span className="truncate text-sm opacity-70">
          {group.description || membersText}
        </span>
      </span>
    </div>
  );
}

export default GroupItem;
