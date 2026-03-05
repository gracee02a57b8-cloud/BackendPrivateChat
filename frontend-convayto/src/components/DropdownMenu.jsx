import { useState } from "react";
import {
  RiMoonClearLine,
  RiContactsBookLine,
  RiSettings2Line,
  RiLogoutCircleLine,
} from "react-icons/ri";
import { useSignout } from "../features/authentication/useSignout";
import { useUi } from "../contexts/UiContext";
import { useUser } from "../features/authentication/useUser";
import Loader from "./Loader";
import ToggleableContent from "./ToggleableContent";
import Menu from "./Menu";
import ContactsModal from "./ContactsModal";
import SettingsModal from "./SettingsModal";

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
  const [contactsOpen, setContactsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  function openContacts() {
    toggleMenu();
    setContactsOpen(true);
  }

  function openSettings() {
    toggleMenu();
    setSettingsOpen(true);
  }

  return (
    <>
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

          <Menu.ButtonItem onClick={openContacts}>
            <RiContactsBookLine />
            <div>Контакты</div>
          </Menu.ButtonItem>

          <Menu.ButtonItem onClick={openSettings}>
            <RiSettings2Line />
            <div>Настройки</div>
          </Menu.ButtonItem>

          <Menu.TogglerItem isChecked={isDarkMode} toggler={toggleDarkMode}>
            <RiMoonClearLine />
            <div>Тёмная тема</div>
          </Menu.TogglerItem>

          <Menu.ButtonItem onClick={signout}>
            {isPending ? <Loader /> : <RiLogoutCircleLine />}
            <div>Выход</div>
          </Menu.ButtonItem>
        </Menu.List>
        <Menu.Footer />
      </Menu>
    </ToggleableContent>

    <ContactsModal isOpen={contactsOpen} onClose={() => setContactsOpen(false)} />
    <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
