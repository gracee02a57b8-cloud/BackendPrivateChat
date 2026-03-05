import { useState } from "react";
import { useUser } from "../authentication/useUser";
import { useUi } from "../../contexts/UiContext";
import Profile from "../../components/Profile";
import DropdownMenu from "../../components/DropdownMenu";
import IconButton from "../../components/IconButton";
import ContactsModal from "../../components/ContactsModal";
import SettingsModal from "../../components/SettingsModal";

function Header() {
  const { user } = useUser();
  const userData = user?.user_metadata;
  const [contactsOpen, setContactsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const {
    openAccountView,
    isSearchViewOpen,
    closeSearchView,
    isMenuOpen,
    toggleMenu,
  } = useUi();

  function handleMenuBtnClick() {
    // if is searching then close search view else open menu
    if (isSearchViewOpen) {
      closeSearchView();
    } else {
      toggleMenu();
    }
  }

  function handleOpenContacts() {
    toggleMenu();
    setContactsOpen(true);
  }

  function handleOpenSettings() {
    toggleMenu();
    setSettingsOpen(true);
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="relative">
          <IconButton onClick={handleMenuBtnClick} addClass="hover:bg-bgAccent/10 dark:hover:bg-bgAccent-dark/10 transition-colors duration-200">
            {isSearchViewOpen && <IconButton.Back />}
            {isMenuOpen && <IconButton.Close />}
            {!isSearchViewOpen && !isMenuOpen && <IconButton.Menu />}
          </IconButton>

          {isMenuOpen && <DropdownMenu onOpenContacts={handleOpenContacts} onOpenSettings={handleOpenSettings} />}
        </div>

        <Profile userData={userData} onClick={openAccountView} />
      </div>

      <ContactsModal isOpen={contactsOpen} onClose={() => setContactsOpen(false)} />
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

export default Header;
