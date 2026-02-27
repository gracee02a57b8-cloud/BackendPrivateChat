import { useUi } from "../../contexts/UiContext";
import { useNavigate } from "react-router-dom";
import ProfileSideBar from "../sideBar/ProfileSideBar";
import useConvInfo from "./useConvInfo";
import Loader from "../../components/Loader";
import Profile from "../../components/Profile";
import IconButton from "../../components/IconButton";
import { useEffect } from "react";
import { APP_NAME } from "../../config";
import { useCall } from "../../contexts/CallContext";
import { useConference } from "../../contexts/ConferenceContext";
import { useOnlineUsers } from "../../hooks/useOnlineUsers";
import {
  RiPhoneLine,
  RiVideoChatLine,
  RiGroupLine,
  RiTeamLine,
} from "react-icons/ri";

function MessageTopBar() {
  const { convInfo, isPending } = useConvInfo();
  const { openFriendSidebar, openSidebar } = useUi();
  const { startCall, callState, CALL_STATE } = useCall();
  const { startConference, confState, CONF_STATE } = useConference();
  const onlineUsers = useOnlineUsers();

  const friend = convInfo?.friendInfo;
  const isGroup = convInfo?.isGroup;
  const roomId = convInfo?.id;
  const isFriendOnline = !isGroup && friend && onlineUsers.has(friend.username || friend.id);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = friend?.fullname || APP_NAME;
  }, [friend]);

  function handleGoBack() {
    if (window.matchMedia("(max-width: 640px)").matches) {
      navigate("/chat", { replace: true });
      document.title = APP_NAME;
    } else {
      openSidebar();
    }
  }

  function handleAudioCall() {
    if (!friend || !roomId || callState !== CALL_STATE.IDLE) return;
    startCall(friend.id, roomId, "audio");
  }

  function handleVideoCall() {
    if (!friend || !roomId || callState !== CALL_STATE.IDLE) return;
    startCall(friend.id, roomId, "video");
  }

  function handleConference() {
    if (!roomId || confState !== CONF_STATE.IDLE) return;
    startConference(roomId, "video");
  }

  function handleGroupAudioConference() {
    if (!roomId || confState !== CONF_STATE.IDLE) return;
    startConference(roomId, "audio");
  }

  return (
    <>
      <div className="z-10 flex min-h-20 select-none items-center gap-2 rounded-b-xl border-b border-l border-r border-transparent bg-bgPrimary p-2 shadow-lg dark:border-LightShade/20 dark:bg-bgPrimary-dark">
        <IconButton addClass="md:hidden" onClick={handleGoBack}>
          <IconButton.Back />
        </IconButton>

        {isPending ? (
          <Loader size="medium" />
        ) : (
          <Profile onClick={openFriendSidebar} userData={friend} online={isFriendOnline} />
        )}

        {/* Call buttons — right side */}
        {!isPending && friend && roomId && (
          <div className="ml-auto flex items-center gap-1">
            {/* Private chat: audio + video call */}
            {!isGroup && (
              <>
                <button
                  onClick={handleAudioCall}
                  disabled={callState !== CALL_STATE.IDLE}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-textPrimary/70 transition hover:bg-LightShade/20 active:scale-95 disabled:opacity-40 dark:text-textPrimary-dark/70"
                  title="Аудиозвонок"
                >
                  <RiPhoneLine />
                </button>
                <button
                  onClick={handleVideoCall}
                  disabled={callState !== CALL_STATE.IDLE}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-textPrimary/70 transition hover:bg-LightShade/20 active:scale-95 disabled:opacity-40 dark:text-textPrimary-dark/70"
                  title="Видеозвонок"
                >
                  <RiVideoChatLine />
                </button>
              </>
            )}

            {/* Group chat: audio, video, conference */}
            {isGroup && (
              <>
                <button
                  onClick={handleGroupAudioConference}
                  disabled={confState !== CONF_STATE.IDLE}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-textPrimary/70 transition hover:bg-LightShade/20 active:scale-95 disabled:opacity-40 dark:text-textPrimary-dark/70"
                  title="Групповой аудиозвонок"
                >
                  <RiPhoneLine />
                </button>
                <button
                  onClick={handleConference}
                  disabled={confState !== CONF_STATE.IDLE}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-textPrimary/70 transition hover:bg-LightShade/20 active:scale-95 disabled:opacity-40 dark:text-textPrimary-dark/70"
                  title="Видеоконференция"
                >
                  <RiVideoChatLine />
                </button>
                <button
                  onClick={handleConference}
                  disabled={confState !== CONF_STATE.IDLE}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-textPrimary/70 transition hover:bg-LightShade/20 active:scale-95 disabled:opacity-40 dark:text-textPrimary-dark/70"
                  title="Конференция"
                >
                  <RiTeamLine />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Hidden right side bar which will reveal if clicked on friend's profile info */}
      <ProfileSideBar friend={friend} />
    </>
  );
}

export default MessageTopBar;
