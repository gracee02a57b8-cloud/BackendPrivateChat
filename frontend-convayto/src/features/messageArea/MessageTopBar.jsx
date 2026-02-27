import { useUi } from "../../contexts/UiContext";
import { useNavigate } from "react-router-dom";
import ProfileSideBar from "../sideBar/ProfileSideBar";
import useConvInfo from "./useConvInfo";
import Loader from "../../components/Loader";
import Profile from "../../components/Profile";
import IconButton from "../../components/IconButton";
import { useEffect, useState, useRef } from "react";
import { APP_NAME } from "../../config";
import { useCall } from "../../contexts/CallContext";
import { useConference } from "../../contexts/ConferenceContext";
import { useOnlineUsers } from "../../hooks/useOnlineUsers";
import { apiFetch } from "../../services/apiHelper";
import {
  RiPhoneLine,
  RiVideoChatLine,
  RiGroupLine,
  RiTeamLine,
  RiSearchLine,
  RiCloseLine,
  RiArrowUpSLine,
  RiArrowDownSLine,
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

  // ── Search ──
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchIdx, setSearchIdx] = useState(-1);
  const [searching, setSearching] = useState(false);
  const searchInputRef = useRef(null);
  const searchTimerRef = useRef(null);

  function toggleSearch() {
    setSearchOpen((v) => {
      if (!v) setTimeout(() => searchInputRef.current?.focus(), 50);
      else { setSearchQuery(""); setSearchResults([]); setSearchIdx(-1); }
      return !v;
    });
  }

  function handleSearchChange(e) {
    const q = e.target.value;
    setSearchQuery(q);
    clearTimeout(searchTimerRef.current);
    if (q.trim().length < 2) { setSearchResults([]); setSearchIdx(-1); return; }
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await apiFetch(`/api/rooms/${encodeURIComponent(roomId)}/search?q=${encodeURIComponent(q.trim())}&page=0&size=50`);
        const results = data?.content || data || [];
        setSearchResults(results);
        setSearchIdx(results.length > 0 ? 0 : -1);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 400);
  }

  function scrollToMessage(msgId) {
    if (!msgId) return;
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-bgAccent", "rounded-xl");
      setTimeout(() => el.classList.remove("ring-2", "ring-bgAccent", "rounded-xl"), 2000);
    }
  }

  function handleSearchNav(dir) {
    if (searchResults.length === 0) return;
    let next = searchIdx + dir;
    if (next < 0) next = searchResults.length - 1;
    if (next >= searchResults.length) next = 0;
    setSearchIdx(next);
    scrollToMessage(searchResults[next]?.id);
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
            {/* Search button */}
            <button
              onClick={toggleSearch}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-xl transition hover:bg-LightShade/20 active:scale-95 ${searchOpen ? 'text-bgAccent dark:text-bgAccent-dark' : 'text-textPrimary/70 dark:text-textPrimary-dark/70'}`}
              title="Поиск сообщений"
            >
              <RiSearchLine />
            </button>
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

      {/* Search bar */}
      {searchOpen && (
        <div className="flex items-center gap-2 border-b border-LightShade/20 bg-bgPrimary px-4 py-2 dark:bg-bgPrimary-dark">
          <RiSearchLine className="flex-shrink-0 text-lg opacity-50" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearchNav(1);
              if (e.key === "Escape") toggleSearch();
            }}
            placeholder="Поиск в чате..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:opacity-50"
          />
          {searching && <Loader size="small" />}
          {searchResults.length > 0 && (
            <span className="text-xs opacity-60">
              {searchIdx + 1}/{searchResults.length}
            </span>
          )}
          <button onClick={() => handleSearchNav(-1)} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-LightShade/20">
            <RiArrowUpSLine />
          </button>
          <button onClick={() => handleSearchNav(1)} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-LightShade/20">
            <RiArrowDownSLine />
          </button>
          <button onClick={toggleSearch} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-LightShade/20">
            <RiCloseLine />
          </button>
        </div>
      )}

      {/* Hidden right side bar which will reveal if clicked on friend's profile info */}
      <ProfileSideBar friend={friend} />
    </>
  );
}

export default MessageTopBar;
