import { useState } from "react";
import UserList from "./UserList";
import GroupList from "./GroupList";
import { RiChat3Line, RiUserLine, RiGroupLine } from "react-icons/ri";

const TABS = [
  { key: "all", label: "Все чаты", icon: RiChat3Line },
  { key: "private", label: "Личные", icon: RiUserLine },
  { key: "groups", label: "Группы", icon: RiGroupLine },
];

function UsersView() {
  const [activeTab, setActiveTab] = useState("all");

  return (
    <div className="grid h-full grid-rows-[auto_1fr]">
      {/* Folder Tabs */}
      <div className="flex border-b border-t border-LightShade/20">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-b-2 border-bgAccent text-bgAccent dark:border-bgAccent-dark dark:text-bgAccent-dark"
                  : "text-textPrimary/60 hover:text-textPrimary dark:text-textPrimary-dark/60 dark:hover:text-textPrimary-dark"
              }`}
            >
              <Icon className="text-base" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div tabIndex={-1} className="h-full overflow-auto p-2">
        {activeTab === "all" && <UserList filter="all" />}
        {activeTab === "private" && <UserList filter="private" />}
        {activeTab === "groups" && <GroupList />}
      </div>
    </div>
  );
}

export default UsersView;
