import { useEffect, useRef } from "react";
import { RiSearchLine, RiCloseLine } from "react-icons/ri";
import { useUi } from "../../contexts/UiContext";

function SearchBox() {
  const { isSearchViewOpen, openSearchView, searchQuery, updateSearchQuery } =
    useUi();
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (!isSearchViewOpen && searchInputRef.current) {
      searchInputRef.current.blur();
    }
  }, [isSearchViewOpen]);

  function handleClear() {
    updateSearchQuery("");
    if (searchInputRef.current) searchInputRef.current.focus();
  }

  return (
    <div className="search-premium group relative rounded-2xl border border-LightShade/[0.08] bg-LightShade/[0.04] transition-all duration-300">
      <label htmlFor="searchPeople" className="sr-only">
        Поиск людей и групп
      </label>
      <input
        id="searchPeople"
        className="w-full rounded-2xl bg-transparent py-2.5 pl-10 pr-9 text-sm outline-none placeholder:text-LightShade/50"
        value={searchQuery}
        onChange={(e) => updateSearchQuery(e.target.value)}
        type="text"
        onClick={() => openSearchView()}
        placeholder="Поиск..."
        aria-label="Поиск людей и групп"
        ref={searchInputRef}
      />

      <span className="search-icon pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg opacity-30 transition-all duration-300">
        <RiSearchLine aria-label="search icon" />
      </span>

      {searchQuery && (
        <button
          onClick={handleClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-lg opacity-40 transition-all hover:bg-LightShade/20 hover:opacity-80"
          aria-label="Очистить поиск"
        >
          <RiCloseLine />
        </button>
      )}
    </div>
  );
}

export default SearchBox;
