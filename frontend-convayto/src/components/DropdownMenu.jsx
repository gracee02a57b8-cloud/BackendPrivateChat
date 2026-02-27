import {
  RiMoonClearLine,
  RiBugLine,
  RiSettings2Line,
  RiLogoutCircleLine,
} from "react-icons/ri";
import { useSignout } from "../features/authentication/useSignout";
import { useUi } from "../contexts/UiContext";
import { useUser } from "../features/authentication/useUser";
import Loader from "./Loader";
import ToggleableContent from "./ToggleableContent";
import Menu from "./Menu";

export default function DropdownMenu() {
  const { user } = useUser();
  const fullname = user?.user_metadata?.fullname || user?.id || "";
  const email = user?.email || "";
  const {
    openAccountView,
    isDarkMode,
    toggleDarkMode,
    isMenuOpen,
    toggleMenu,
  } = useUi();
  const { signout, isPending } = useSignout();

  return (
    <ToggleableContent
      isOpen={isMenuOpen}
      toggle={toggleMenu}
      withOverlay={false}
    >
      <Menu>
        <Menu.Header>
          <Menu.Header.Name>{fullname}</Menu.Header.Name>
          {email && <Menu.Header.Email>{email}</Menu.Header.Email>}
        </Menu.Header>

        <Menu.List>
          <Menu.ButtonItem onClick={openAccountView}>
            <RiSettings2Line />
            <div>Мой аккаунт</div>
          </Menu.ButtonItem>

          <Menu.TogglerItem isChecked={isDarkMode} toggler={toggleDarkMode}>
            <RiMoonClearLine />
            <div>Тёмная тема</div>
          </Menu.TogglerItem>

          <Menu.LinkItem
            href="#"
          >
            <RiBugLine />
            <div>Сообщить об ошибке</div>
          </Menu.LinkItem>

          <Menu.ButtonItem onClick={signout}>
            {isPending ? <Loader /> : <RiLogoutCircleLine />}
            <div>Выход</div>
          </Menu.ButtonItem>
        </Menu.List>
        <Menu.Footer />
      </Menu>
    </ToggleableContent>
  );
}
