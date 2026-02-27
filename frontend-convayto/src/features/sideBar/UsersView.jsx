import { useState } from "react";
import UserList from "./UserList";
import ContactList from "./ContactList";
import GroupList from "./GroupList";

const TABS = [
  { key: "chats", label: "Чаты" },
  { key: "contacts", label: "Контакты" },
  { key: "groups", label: "Группы" },
];

function UsersView() {
  const [activeTab, setActiveTab] = useState("chats");

  return (
    <div className="grid h-full grid-rows-[auto_1fr]">
      {/* Tabs */}
      <div className="flex border-b border-t border-LightShade/20">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-2 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-bgAccent text-bgAccent dark:border-bgAccent-dark dark:text-bgAccent-dark"
                : "text-textPrimary/60 hover:text-textPrimary dark:text-textPrimary-dark/60 dark:hover:text-textPrimary-dark"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div tabIndex={-1} className="h-full overflow-auto p-2">
        {activeTab === "chats" && <UserList />}
        {activeTab === "contacts" && <ContactList />}
        {activeTab === "groups" && <GroupList />}
      </div>
    </div>
  );
}

export default UsersView;
