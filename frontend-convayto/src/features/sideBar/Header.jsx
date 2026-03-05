import { useUser } from "../authentication/useUser";
import { useUi } from "../../contexts/UiContext";
import Profile from "../../components/Profile";
import DropdownMenu from "../../components/DropdownMenu";
import IconButton from "../../components/IconButton";

function Header() {
  const { user } = useUser();
  const userData = user?.user_metadata;

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

  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="relative">
        <IconButton onClick={handleMenuBtnClick} addClass="hover:bg-bgAccent/10 dark:hover:bg-bgAccent-dark/10 transition-colors duration-200">
          {isSearchViewOpen && <IconButton.Back />}
          {isMenuOpen && <IconButton.Close />}
          {!isSearchViewOpen && !isMenuOpen && <IconButton.Menu />}
        </IconButton>

        {isMenuOpen && <DropdownMenu />}
      </div>

      <Profile userData={userData} onClick={openAccountView} />
    </div>
  );
}

export default Header;
