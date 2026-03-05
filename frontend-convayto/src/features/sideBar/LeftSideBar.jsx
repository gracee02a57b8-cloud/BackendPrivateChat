import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useUi } from "../../contexts/UiContext";
import ToggleableContent from "../../components/ToggleableContent";
import MyAccountView from "../userProfile/MyAccountView";
import TricksView from "../tricks/TricksView";
import DefaultView from "./DefaultView";

function LeftSideBar() {
  const { isSidebarOpen, isAccountViewOpen, isTricksViewOpen, closeSidebar, openSidebar } =
    useUi();
  const { userId, roomId } = useParams();
  const hasActiveChat = !!(userId || roomId);

  useEffect(() => {
    hasActiveChat ? closeSidebar() : openSidebar();
  }, [hasActiveChat]);

  function handleToggleSidebar() {
    hasActiveChat && closeSidebar();
  }

  return (
    <ToggleableContent isOpen={isSidebarOpen} toggle={handleToggleSidebar}>
      <aside
        className={`${
          isSidebarOpen
            ? "visible left-0 opacity-100"
            : "invisible -left-full opacity-0"
        } relative absolute top-0 z-30 h-screen-safe w-full overflow-hidden bg-bgPrimary shadow-2xl transition-all duration-500 ease-[cubic-bezier(.15,.72,.08,.99)] dark:bg-bgPrimary-dark sm:w-[23rem] md:visible md:relative md:left-0 md:opacity-100`}
      >
        {isAccountViewOpen ? <MyAccountView /> : isTricksViewOpen ? <TricksView /> : <DefaultView />}
        <div className="sidebar-accent-line hidden md:block" />
      </aside>
    </ToggleableContent>
  );
}

export default LeftSideBar;
