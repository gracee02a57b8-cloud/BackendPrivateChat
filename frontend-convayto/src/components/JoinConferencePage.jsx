// ==========================================
// JoinConferencePage — join conference via invite link
// ==========================================
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useConference } from "../contexts/ConferenceContext";
import Loader from "./Loader";

const API = import.meta.env.VITE_API_URL || "";

function JoinConferencePage() {
  const { confId } = useParams();
  const navigate = useNavigate();
  const { joinConferenceById, confState, CONF_STATE } = useConference();
  const [error, setError] = useState(null);
  const [confInfo, setConfInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const joinedRef = useRef(false);

  const token = localStorage.getItem("token");
  const isAuthenticated = !!token;

  // Fetch public conference info (no auth required)
  useEffect(() => {
    if (!confId) return;
    fetch(`${API}/api/conference/${confId}/info`)
      .then((r) => {
        if (!r.ok) throw new Error("not_found");
        return r.json();
      })
      .then((data) => {
        setConfInfo(data);
        setLoadingInfo(false);
      })
      .catch(() => {
        setLoadingInfo(false);
        setError("Конференция не найдена или уже завершилась");
      });
  }, [confId]);

  // Auto-join if authenticated
  useEffect(() => {
    if (!confId || joinedRef.current || !isAuthenticated || loadingInfo || error) return;
    joinedRef.current = true;

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
  }, [confId, isAuthenticated, loadingInfo, error, joinConferenceById, navigate]);

  // Not authenticated — show conference preview + login/register buttons
  if (!isAuthenticated) {
    // Save confId so after auth we redirect back
    sessionStorage.setItem("pendingConference", confId);

    if (loadingInfo) {
      return (
        <div className="flex h-screen items-center justify-center bg-gray-900">
          <Loader size="large" text="Загрузка..." />
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-gray-800 p-6 text-center text-white shadow-2xl">
          {error ? (
            <>
              <div className="mb-4 text-5xl">⚠️</div>
              <h2 className="text-xl font-bold">{error}</h2>
              <p className="mt-2 text-sm text-gray-400">
                Конференция могла завершиться или ссылка недействительна.
              </p>
            </>
          ) : (
            <>
              <div className="mb-4 text-5xl">📹</div>
              <h2 className="text-xl font-bold">Приглашение в конференцию</h2>
              {confInfo && (
                <p className="mt-2 text-sm text-gray-400">
                  Участников: {confInfo.count} / {confInfo.maxParticipants}
                </p>
              )}
              <p className="mt-3 text-sm text-gray-300">
                Для подключения необходимо войти или зарегистрироваться
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <Link
                  to="/signin"
                  className="block rounded-xl bg-blue-500 px-6 py-2.5 font-medium text-white transition hover:bg-blue-600 active:scale-95"
                >
                  Войти
                </Link>
                <Link
                  to="/signup"
                  className="block rounded-xl bg-white/10 px-6 py-2.5 font-medium text-white transition hover:bg-white/20 active:scale-95"
                >
                  Зарегистрироваться
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Authenticated — show error or loading
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
