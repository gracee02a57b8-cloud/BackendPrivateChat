// ==========================================
// JoinConferencePage — join conference via invite link
// ==========================================
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useConference } from "../contexts/ConferenceContext";
import Loader from "./Loader";

function JoinConferencePage() {
  const { confId } = useParams();
  const navigate = useNavigate();
  const { joinConferenceById, confState, CONF_STATE } = useConference();
  const [error, setError] = useState(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!confId || joinedRef.current) return;
    joinedRef.current = true;

    const token = localStorage.getItem("token");
    if (!token) {
      // Save conference link for after login
      sessionStorage.setItem("pendingConference", confId);
      navigate("/signin", { replace: true });
      return;
    }

    joinConferenceById(confId)
      .then((roomId) => {
        if (roomId) {
          navigate(`/chat/room/${roomId}`, { replace: true });
        } else {
          navigate("/chat", { replace: true });
        }
      })
      .catch((e) => {
        setError(e.message || "Не удалось присоединиться к конференции");
      });
  }, [confId, joinConferenceById, navigate]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-bgPrimary dark:bg-bgPrimary-dark">
        <div className="text-center">
          <p className="text-xl font-semibold text-red-500">⚠️ {error}</p>
          <p className="mt-2 text-sm text-textPrimary/60 dark:text-textPrimary-dark/60">
            Конференция могла завершиться или ссылка недействительна
          </p>
          <button
            onClick={() => navigate("/chat", { replace: true })}
            className="mt-4 rounded-xl bg-bgAccent px-6 py-2.5 font-medium text-white transition hover:bg-bgAccentDim active:scale-95 dark:bg-bgAccent-dark dark:hover:bg-bgAccentDim-dark"
          >
            Вернуться в чат
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-bgPrimary dark:bg-bgPrimary-dark">
      <Loader size="large" text="Подключение к конференции..." />
    </div>
  );
}

export default JoinConferencePage;
