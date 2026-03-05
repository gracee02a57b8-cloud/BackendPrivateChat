import { useState, useEffect, useCallback } from "react";
import { RiCloseLine, RiVolumeUpLine, RiVolumeMuteLine, RiNotification3Line, RiNotificationOffLine } from "react-icons/ri";
import { initPushNotifications, unsubscribePush } from "../services/pushService";
import toast from "react-hot-toast";

function SettingsModal({ isOpen, onClose }) {
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("soundEnabled") !== "false");
  const [pushEnabled, setPushEnabled] = useState(() => localStorage.getItem("pushEnabled") !== "false");
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSoundEnabled(localStorage.getItem("soundEnabled") !== "false");
      setPushEnabled(localStorage.getItem("pushEnabled") !== "false");
    }
  }, [isOpen]);

  const toggleSound = useCallback(() => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem("soundEnabled", String(next));
    toast.success(next ? "Звук включён" : "Звук выключен");
  }, [soundEnabled]);

  const togglePush = useCallback(async () => {
    setPushLoading(true);
    const next = !pushEnabled;
    try {
      if (next) {
        localStorage.setItem("pushEnabled", "true");
        await initPushNotifications();
        setPushEnabled(true);
        toast.success("Push-уведомления включены");
      } else {
        localStorage.setItem("pushEnabled", "false");
        await unsubscribePush();
        setPushEnabled(false);
        toast.success("Push-уведомления выключены");
      }
    } catch {
      toast.error("Ошибка настройки уведомлений");
      localStorage.setItem("pushEnabled", String(!next));
      setPushEnabled(!next);
    } finally {
      setPushLoading(false);
    }
  }, [pushEnabled]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-bgPrimary shadow-2xl dark:bg-bgPrimary-dark" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-LightShade/10 px-5 py-4">
          <h2 className="text-lg font-semibold">Настройки</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-LightShade/20">
            <RiCloseLine className="text-xl" />
          </button>
        </div>

        {/* Settings */}
        <div className="space-y-1 p-3">
          {/* Sound toggle */}
          <button onClick={toggleSound} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition hover:bg-LightShade/10">
            {soundEnabled ? (
              <RiVolumeUpLine className="text-xl text-bgAccent dark:text-bgAccent-dark" />
            ) : (
              <RiVolumeMuteLine className="text-xl opacity-50" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">Звук уведомлений</p>
              <p className="text-xs opacity-50">{soundEnabled ? "Включён" : "Выключен"}</p>
            </div>
            <div className={`relative h-6 w-11 rounded-full transition-colors ${soundEnabled ? "bg-bgAccent dark:bg-bgAccent-dark" : "bg-LightShade/20"}`}>
              <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${soundEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
          </button>

          {/* Push toggle */}
          <button onClick={togglePush} disabled={pushLoading} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition hover:bg-LightShade/10 disabled:opacity-60">
            {pushEnabled ? (
              <RiNotification3Line className="text-xl text-bgAccent dark:text-bgAccent-dark" />
            ) : (
              <RiNotificationOffLine className="text-xl opacity-50" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">Push-уведомления</p>
              <p className="text-xs opacity-50">{pushLoading ? "Настройка..." : pushEnabled ? "Включены" : "Выключены"}</p>
            </div>
            <div className={`relative h-6 w-11 rounded-full transition-colors ${pushEnabled ? "bg-bgAccent dark:bg-bgAccent-dark" : "bg-LightShade/20"}`}>
              <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${pushEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
          </button>
        </div>

        <div className="px-5 pb-4 pt-1">
          <p className="text-center text-xs opacity-30">Push-уведомления требуют разрешения браузера</p>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
