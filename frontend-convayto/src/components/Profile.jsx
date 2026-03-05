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
      className="profile-card-premium mr-auto grid cursor-pointer grid-cols-[2.5rem_1fr] gap-3 truncate rounded-xl border border-LightShade/[0.08] bg-LightShade/[0.03] p-2.5 transition-all duration-250"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center">
        <img
          src={avatar_url}
          alt={fullname}
          className="pointer-events-none h-full w-full rounded-full object-cover ring-2 ring-LightShade/[0.08] transition-all duration-300"
        />
        {online && (
          <span className="online-pulse absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-bgPrimary bg-green-500 dark:border-bgPrimary-dark" />
        )}
      </div>

      <div className="truncate text-left">
        <p className="truncate text-sm font-semibold">{fullname}</p>
        <p className="truncate text-xs opacity-50">
          {online ? (
            <span className="font-medium text-green-500">в сети</span>
          ) : (
            <>@{username}</>
          )}
        </p>
      </div>
    </div>
  );
}

export default Profile;
