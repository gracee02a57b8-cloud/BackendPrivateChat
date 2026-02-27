import { useEnterKeyPress } from "../utils/useEnterKeyPress";
import { getRandomAvatar } from "../utils/avatarUtils";

function Profile({ onClick, userData }) {
  const fullname = userData?.fullname;
  const username = userData?.username;
  const avatar_url = userData?.avatar_url || getRandomAvatar(username || fullname);

  const handleKeyDown = useEnterKeyPress(onClick);

  if (!userData) return <span>⚠️</span>;

  return (
    <div
      className="mr-auto grid cursor-pointer grid-cols-[2.5rem_1fr] gap-4 truncate rounded-lg border border-LightShade/20 bg-LightShade/5 p-2 hover:bg-LightShade/20"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full">
        <img
          src={avatar_url}
          alt={fullname}
          className="pointer-events-none h-full w-full object-cover"
        />
      </div>

      <div className="truncate text-left">
        <p className="truncate">{fullname}</p>
        <p className="truncate text-sm opacity-70">@{username}</p>
      </div>
    </div>
  );
}

export default Profile;
