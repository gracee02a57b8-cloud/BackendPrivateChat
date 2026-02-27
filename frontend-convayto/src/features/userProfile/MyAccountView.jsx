import { useUi } from "../../contexts/UiContext";
import Avatar from "./Avatar";
import BtnRecoverPassword from "./BtnRecoverPassword";
import { useUser } from "../authentication/useUser";
import IconButton from "../../components/IconButton";
import InfoField from "./InfoField";
import {
  MAX_NAME_LENGTH,
  MIN_USERNAME_LENGTH,
  MAX_USERNAME_LENGTH,
  MAX_BIO_LENGTH,
  NAME_REGEX,
  USERNAME_REGEX,
} from "../../config";
import useCheckUsernameAvailability from "../authentication/useCheckUsernameAvailability";

function MyAccountView() {
  const { isBusy, isChecking, isTaken, checkUsername, reset } =
    useCheckUsernameAvailability();
  const { user } = useUser();
  const fullname = user?.user_metadata?.fullname || "";
  const username = user?.user_metadata?.username || "";
  const bio = user?.user_metadata?.bio || "";
  const avatar_url = user?.user_metadata?.avatar_url || "";

  const { closeAccountView } = useUi();

  return (
    <div className="fadeIn grid h-screen-safe grid-rows-[auto_1fr] bg-bgPrimary dark:bg-bgPrimary-dark">
      <div className="flex h-16 items-center justify-start gap-4 bg-LightShade/10 p-2">
        <IconButton onClick={closeAccountView}>
          <IconButton.Back />
        </IconButton>
        <p className="select-none font-bold tracking-wider">Профиль</p>
      </div>

      <div tabIndex={-1} className="h-full overflow-scroll p-10">
        <Avatar avatar={avatar_url} />

        <InfoField
          label="Имя"
          oldValue={fullname}
          updateKey="fullname"
          maxLength={MAX_NAME_LENGTH}
          regex={NAME_REGEX}
          patternMessage="Только буквы, цифры и одиночные пробелы."
        />

        <InfoField
          label="Логин"
          oldValue={username}
          updateKey="username"
          minLength={MIN_USERNAME_LENGTH}
          maxLength={MAX_USERNAME_LENGTH}
          regex={USERNAME_REGEX}
          patternMessage="Только строчные буквы, цифры, _ и -."
          checkUsername={checkUsername}
          isChecking={isChecking}
          isTaken={isTaken}
          isBusy={isBusy}
          reset={reset}
        />

        <InfoField
          label="О себе"
          oldValue={bio}
          updateKey="bio"
          maxLength={MAX_BIO_LENGTH}
        />

        <BtnRecoverPassword />
      </div>
    </div>
  );
}

export default MyAccountView;
