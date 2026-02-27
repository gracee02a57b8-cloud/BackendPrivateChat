import { useState } from "react";
import UserList from "./UserList";
import GroupList from "./GroupList";
import ContactList from "./ContactList";
import { RiUserLine, RiGroupLine, RiContactsBookLine } from "react-icons/ri";

const TABS = [
  { key: "private", label: "Личные", icon: RiUserLine },
  { key: "groups", label: "Группы", icon: RiGroupLine },
  { key: "contacts", label: "Контакты", icon: RiContactsBookLine },
];

function UsersView() {
  const [activeTab, setActiveTab] = useState("private");

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
              className={`flex flex-1 items-center justify-center gap-1 px-1.5 py-2.5 text-xs font-medium transition-colors ${
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
        {activeTab === "private" && <UserList filter="private" />}
        {activeTab === "groups" && <GroupList />}
        {activeTab === "contacts" && <ContactList />}
      </div>
    </div>
  );
}

export default UsersView;
