import Copyright from "../../components/Copyright";
import { useUi } from "../../contexts/UiContext";
import SearchView from "../userSearch/SearchView";
import Header from "./Header";
import SearchBox from "./SearchBox";
import UsersView from "./UsersView";

function DefaultView() {
  const { isSearchViewOpen } = useUi();

  return (
    <div className="relative z-30 flex h-screen-safe select-none flex-col overflow-hidden">
      {/* Glass header zone */}
      <div className="glass-surface relative z-10 border-b border-LightShade/[0.06] bg-bgPrimary/80 px-3 pb-3 pt-4 dark:bg-bgPrimary-dark/80">
        <Header />
        <SearchBox />
      </div>

      {/* Content area */}
      <div className="premium-scroll relative flex-1 overflow-auto">
        {isSearchViewOpen ? <SearchView /> : <UsersView />}
      </div>

      <Copyright />
    </div>
  );
}

export default DefaultView;
