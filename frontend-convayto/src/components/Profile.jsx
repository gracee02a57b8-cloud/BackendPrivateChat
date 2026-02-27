import { useEnterKeyPress } from "../utils/useEnterKeyPress";
import { getRandomAvatar } from "../utils/avatarUtils";

function Profile({ onClick, userData, online }) {
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
      <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center">
        <img
          src={avatar_url}
          alt={fullname}
          className="pointer-events-none h-full w-full rounded-full object-cover"
        />
        {online && (
          <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-bgPrimary bg-green-500 dark:border-bgPrimary-dark" />
        )}
      </div>

      <div className="truncate text-left">
        <p className="truncate">{fullname}</p>
        <p className="truncate text-sm opacity-70">
          {online ? (
            <span className="text-green-500">в сети</span>
          ) : (
            <>@{username}</>
          )}
        </p>
      </div>
    </div>
  );
}

export default Profile;
