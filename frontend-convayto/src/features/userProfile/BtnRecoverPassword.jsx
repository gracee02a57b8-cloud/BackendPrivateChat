import { useState } from "react";
import { useUpdateUser } from "./useUpdateUser";
import Loader from "../../components/Loader";
import toast from "react-hot-toast";
import { MIN_PASSWORD_LENGTH } from "../../config";

function BtnRecoverPassword() {
  const [isOpen, setIsOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { updateUser, isUpdating } = useUpdateUser();

  function handleSubmit(e) {
    e.preventDefault();
    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Минимум ${MIN_PASSWORD_LENGTH} символов`);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Пароли не совпадают");
      return;
    }
    updateUser(
      { password: newPassword },
      {
        onSuccess: () => {
          toast.dismiss();
          toast.success("Пароль обновлён!");
          setIsOpen(false);
          setNewPassword("");
          setConfirmPassword("");
        },
      },
    );
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="mt-8 flex h-10 items-center gap-2 rounded-md bg-bgAccent px-4 text-textPrimary-dark hover:bg-bgAccentDim dark:bg-bgAccent-dark dark:hover:bg-bgAccentDim-dark"
      >
        Сменить пароль
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
      <p className="text-sm font-bold opacity-70">Смена пароля</p>
      <input
        type="password"
        placeholder="Новый пароль"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        className="rounded-md border border-LightShade/30 bg-transparent px-3 py-2 text-sm outline-none focus:border-bgAccent dark:focus:border-bgAccent-dark"
        disabled={isUpdating}
      />
      <input
        type="password"
        placeholder="Подтвердите пароль"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        className="rounded-md border border-LightShade/30 bg-transparent px-3 py-2 text-sm outline-none focus:border-bgAccent dark:focus:border-bgAccent-dark"
        disabled={isUpdating}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isUpdating}
          className="flex h-10 items-center gap-2 rounded-md bg-bgAccent px-4 text-textPrimary-dark hover:bg-bgAccentDim disabled:opacity-50 dark:bg-bgAccent-dark dark:hover:bg-bgAccentDim-dark"
        >
          {isUpdating ? <Loader /> : "Сохранить"}
        </button>
        <button
          type="button"
          onClick={() => { setIsOpen(false); setNewPassword(""); setConfirmPassword(""); }}
          className="flex h-10 items-center rounded-md border border-LightShade/30 px-4 text-sm opacity-70 hover:opacity-100"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}

export default BtnRecoverPassword;
