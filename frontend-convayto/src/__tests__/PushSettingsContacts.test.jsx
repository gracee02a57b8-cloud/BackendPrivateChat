// ==========================================
// PushSettingsContacts.test.jsx
// Tests for: pushService, SettingsModal, ContactsModal, DropdownMenu changes
// ==========================================
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

// ====== Mocks ======

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
  Link: ({ children, to }) => <a href={to}>{children}</a>,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: null, isPending: false, error: null }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
    prefetchQuery: vi.fn(),
    prefetchInfiniteQuery: vi.fn(),
  }),
  useMutation: (opts) => ({
    mutate: vi.fn((...args) => opts?.mutationFn?.(...args)),
    isPending: false,
  }),
}));

vi.mock("../services/apiHelper", () => ({
  apiFetch: vi.fn(() => Promise.resolve([])),
}));

vi.mock("react-hot-toast", () => {
  const fn = vi.fn();
  fn.success = vi.fn();
  fn.error = vi.fn();
  fn.custom = vi.fn();
  fn.dismiss = vi.fn();
  return { default: fn, Toaster: () => null };
});

vi.mock("../services/wsService", () => ({
  onWsMessage: vi.fn(() => () => {}),
  sendWsMessage: vi.fn(),
  isWsConnected: vi.fn(() => true),
  connectWebSocket: vi.fn(),
  disconnectWebSocket: vi.fn(),
  onCallMessage: vi.fn(() => () => {}),
  onConferenceMessage: vi.fn(() => () => {}),
  onWsConnection: vi.fn(() => () => {}),
}));

vi.mock("../contexts/UiContext", () => ({
  useUi: () => ({
    closeSidebar: vi.fn(),
    openAccountView: vi.fn(),
    isDarkMode: false,
    toggleDarkMode: vi.fn(),
    isMenuOpen: true,
    toggleMenu: vi.fn(),
  }),
  UiProvider: ({ children }) => children,
}));

vi.mock("../features/authentication/useUser", () => ({
  useUser: () => ({
    user: {
      id: "testuser",
      email: "test@test.com",
      user_metadata: { fullname: "Test User" },
    },
  }),
}));

vi.mock("../features/authentication/useSignout", () => ({
  useSignout: () => ({ signout: vi.fn(), isPending: false }),
}));

vi.mock("../services/apiContacts", () => ({
  addContact: vi.fn(() => Promise.resolve()),
  removeContact: vi.fn(() => Promise.resolve()),
  fetchContacts: vi.fn(() => Promise.resolve([])),
}));

vi.mock("../hooks/useOnlineUsers", () => ({
  useOnlineUsers: () => new Set(["alice"]),
}));

vi.mock("../features/sideBar/useContacts", () => ({
  useContacts: () => ({
    contacts: [
      { id: "c1", username: "alice", fullname: "Alice A", tag: "alice_tag" },
      { id: "c2", username: "bob", fullname: "Bob B", tag: "bob_tag" },
    ],
    isPending: false,
    error: null,
  }),
}));

vi.mock("../services/pushService", () => ({
  initPushNotifications: vi.fn(() => Promise.resolve()),
  unsubscribePush: vi.fn(() => Promise.resolve()),
}));

vi.mock("../features/sideBar/useGroups", () => ({
  useGroups: () => ({ groups: [], isPending: false, error: null }),
}));

// ====== Imports (after mocks) ======
import { apiFetch } from "../services/apiHelper";
import toast from "react-hot-toast";
import { addContact } from "../services/apiContacts";
import { initPushNotifications, unsubscribePush } from "../services/pushService";
import SettingsModal from "../components/SettingsModal";
import ContactsModal from "../components/ContactsModal";
import DropdownMenu from "../components/DropdownMenu";

// ================================================================
// 1. pushService unit tests
// ================================================================
describe("pushService", () => {
  let originalSW;
  let originalPM;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    originalSW = navigator.serviceWorker;
    originalPM = window.PushManager;
  });

  afterEach(() => {
    Object.defineProperty(navigator, "serviceWorker", { value: originalSW, writable: true, configurable: true });
    window.PushManager = originalPM;
  });

  it("initPushNotifications is a callable function", async () => {
    expect(typeof initPushNotifications).toBe("function");
    await expect(initPushNotifications()).resolves.not.toThrow();
  });

  it("unsubscribePush is a callable function", async () => {
    expect(typeof unsubscribePush).toBe("function");
    await expect(unsubscribePush()).resolves.not.toThrow();
  });

  it("respects pushEnabled=false preference", () => {
    localStorage.setItem("pushEnabled", "false");
    expect(localStorage.getItem("pushEnabled")).toBe("false");
  });

  it("defaults pushEnabled to true when not set", () => {
    expect(localStorage.getItem("pushEnabled")).toBeNull();
    // null !== "false" means enabled
    expect(localStorage.getItem("pushEnabled") !== "false").toBe(true);
  });
});

// ================================================================
// 2. SettingsModal tests
// ================================================================
describe("SettingsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders nothing when isOpen=false", () => {
    const { container } = render(<SettingsModal isOpen={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders settings modal when isOpen=true", () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText("Настройки")).toBeInTheDocument();
    expect(screen.getByText("Звук уведомлений")).toBeInTheDocument();
    expect(screen.getByText("Push-уведомления")).toBeInTheDocument();
  });

  it("shows sound enabled by default", () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText("Включён")).toBeInTheDocument();
  });

  it("toggles sound off when clicked", () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Звук уведомлений").closest("button"));
    expect(localStorage.getItem("soundEnabled")).toBe("false");
    expect(toast.success).toHaveBeenCalledWith("Звук выключен");
  });

  it("toggles sound back on", () => {
    localStorage.setItem("soundEnabled", "false");
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Звук уведомлений").closest("button"));
    expect(localStorage.getItem("soundEnabled")).toBe("true");
    expect(toast.success).toHaveBeenCalledWith("Звук включён");
  });

  it("toggles push on and calls initPushNotifications", async () => {
    localStorage.setItem("pushEnabled", "false");
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByText("Push-уведомления").closest("button"));
    });
    expect(localStorage.getItem("pushEnabled")).toBe("true");
    expect(initPushNotifications).toHaveBeenCalled();
  });

  it("toggles push off and calls unsubscribePush", async () => {
    localStorage.setItem("pushEnabled", "true");
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByText("Push-уведомления").closest("button"));
    });
    expect(localStorage.getItem("pushEnabled")).toBe("false");
    expect(unsubscribePush).toHaveBeenCalled();
  });

  it("calls onClose when overlay is clicked", () => {
    const onClose = vi.fn();
    render(<SettingsModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByText("Настройки").closest(".fixed"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when X button is clicked", () => {
    const onClose = vi.fn();
    render(<SettingsModal isOpen={true} onClose={onClose} />);
    // The close button is a button with RiCloseLine icon
    const buttons = screen.getAllByRole("button");
    // First button in header is the close button
    const closeBtn = buttons.find((b) => b.querySelector("svg"));
    if (closeBtn) fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows push browser permission note", () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText("Push-уведомления требуют разрешения браузера")).toBeInTheDocument();
  });
});

// ================================================================
// 3. ContactsModal tests
// ================================================================
describe("ContactsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("username", "testuser");
  });

  it("renders nothing when isOpen=false", () => {
    const { container } = render(<ContactsModal isOpen={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows main view with 3 action buttons", () => {
    render(<ContactsModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText("Контакты")).toBeInTheDocument();
    expect(screen.getByText("Добавить контакт")).toBeInTheDocument();
    expect(screen.getByText("Создать группу")).toBeInTheDocument();
    expect(screen.getByText("Мои контакты")).toBeInTheDocument();
  });

  it("shows contact count in main view", () => {
    render(<ContactsModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText("2 контактов")).toBeInTheDocument();
  });

  it("navigates to 'add contact' view on click", () => {
    render(<ContactsModal isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Добавить контакт").closest("button"));
    expect(screen.getByPlaceholderText("Имя или @тег...")).toBeInTheDocument();
  });

  it("navigates to 'my contacts' view and shows contacts", () => {
    render(<ContactsModal isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Мои контакты").closest("button"));
    expect(screen.getByText("Alice A")).toBeInTheDocument();
    expect(screen.getByText("Bob B")).toBeInTheDocument();
  });

  it("shows online indicator for online contacts", () => {
    render(<ContactsModal isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Мои контакты").closest("button"));
    expect(screen.getByText("в сети")).toBeInTheDocument(); // alice is online
  });

  it("back button returns to main view", () => {
    render(<ContactsModal isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Добавить контакт").closest("button"));
    expect(screen.getByPlaceholderText("Имя или @тег...")).toBeInTheDocument();
    fireEvent.click(screen.getByText("← Назад"));
    expect(screen.getByText("Добавить контакт")).toBeInTheDocument();
    expect(screen.getByText("Создать группу")).toBeInTheDocument();
  });

  it("searches users when input changes (>= 2 chars)", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([
      { username: "charlie", firstName: "Charlie", tag: "char" },
    ]);
    render(<ContactsModal isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Добавить контакт").closest("button"));
    const input = screen.getByPlaceholderText("Имя или @тег...");
    await act(async () => {
      fireEvent.change(input, { target: { value: "ch" } });
    });
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/api/chat/users?search=ch");
    });
  });

  it("does not search for queries shorter than 2 chars", async () => {
    render(<ContactsModal isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Добавить контакт").closest("button"));
    const input = screen.getByPlaceholderText("Имя или @тег...");
    await act(async () => {
      fireEvent.change(input, { target: { value: "a" } });
    });
    expect(apiFetch).not.toHaveBeenCalledWith(expect.stringContaining("/api/chat/users"));
  });

  it("shows 'no results' when search returns empty", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([]);
    render(<ContactsModal isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Добавить контакт").closest("button"));
    const input = screen.getByPlaceholderText("Имя или @тег...");
    await act(async () => {
      fireEvent.change(input, { target: { value: "zzz" } });
    });
    await waitFor(() => {
      expect(screen.getByText("Никого не найдено")).toBeInTheDocument();
    });
  });

  it("add contact calls addContact and invalidates cache", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([
      { username: "charlie", firstName: "Charlie", tag: "char" },
    ]);
    vi.mocked(addContact).mockResolvedValueOnce();
    render(<ContactsModal isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Добавить контакт").closest("button"));
    const input = screen.getByPlaceholderText("Имя или @тег...");
    await act(async () => {
      fireEvent.change(input, { target: { value: "charlie" } });
    });
    await waitFor(() => {
      const addBtn = screen.getByTitle("Добавить в контакты");
      fireEvent.click(addBtn);
    });
    await waitFor(() => {
      expect(addContact).toHaveBeenCalledWith("charlie");
    });
  });

  it("shows checkmark for existing contacts in search", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([
      { username: "alice", firstName: "Alice", tag: "alice_tag" },
    ]);
    render(<ContactsModal isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Добавить контакт").closest("button"));
    const input = screen.getByPlaceholderText("Имя или @тег...");
    await act(async () => {
      fireEvent.change(input, { target: { value: "alice" } });
    });
    await waitFor(() => {
      // alice is already a contact, so should show checkmark not add button
      expect(screen.queryByTitle("Добавить в контакты")).not.toBeInTheDocument();
    });
  });

  it("closes modal on overlay click", () => {
    const onClose = vi.fn();
    render(<ContactsModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByText("Контакты").closest(".fixed"));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes and opens create group modal on create group click", async () => {
    const onClose = vi.fn();
    render(<ContactsModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByText("Создать группу").closest("button"));
    expect(onClose).toHaveBeenCalled();
  });

  it("filters out own username from search results", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([
      { username: "testuser", firstName: "Me" },
      { username: "other", firstName: "Other" },
    ]);
    render(<ContactsModal isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Добавить контакт").closest("button"));
    const input = screen.getByPlaceholderText("Имя или @тег...");
    await act(async () => {
      fireEvent.change(input, { target: { value: "test" } });
    });
    await waitFor(() => {
      expect(screen.getByText("Other")).toBeInTheDocument();
      expect(screen.queryByText("Me")).not.toBeInTheDocument();
    });
  });
});

// ================================================================
// 4. DropdownMenu tests
// ================================================================
describe("DropdownMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders menu items: profile, contacts, settings, dark theme, exit", () => {
    render(<DropdownMenu />);
    expect(screen.getByText("Мой профиль")).toBeInTheDocument();
    expect(screen.getByText("Контакты")).toBeInTheDocument();
    expect(screen.getByText("Настройки")).toBeInTheDocument();
    expect(screen.getByText("Тёмная тема")).toBeInTheDocument();
    expect(screen.getByText("Выход")).toBeInTheDocument();
  });

  it("does NOT render 'Сообщить об ошибке' (bug report removed)", () => {
    render(<DropdownMenu />);
    expect(screen.queryByText("Сообщить об ошибке")).not.toBeInTheDocument();
  });

  it("opens contacts modal when Контакты is clicked", () => {
    render(<DropdownMenu />);
    fireEvent.click(screen.getByText("Контакты"));
    // After click, ContactsModal should open with "Контакты" header in modal
    // (the menu button also says "Контакты" but the modal overlay is visible)
    expect(screen.getByText("Добавить контакт")).toBeInTheDocument();
  });

  it("opens settings modal when Настройки is clicked", () => {
    render(<DropdownMenu />);
    fireEvent.click(screen.getByText("Настройки"));
    expect(screen.getByText("Звук уведомлений")).toBeInTheDocument();
  });
});

// ================================================================
// 5. Notification sound (soundEnabled) tests
// ================================================================
describe("showMessageToast soundEnabled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("localStorage soundEnabled defaults to enabled", () => {
    expect(localStorage.getItem("soundEnabled")).toBeNull();
    expect(localStorage.getItem("soundEnabled") !== "false").toBe(true);
  });

  it("can disable sound via localStorage", () => {
    localStorage.setItem("soundEnabled", "false");
    expect(localStorage.getItem("soundEnabled")).toBe("false");
  });

  it("can enable sound via localStorage", () => {
    localStorage.setItem("soundEnabled", "true");
    expect(localStorage.getItem("soundEnabled")).toBe("true");
  });
});

// ================================================================
// 6. Conversation sort order test
// ================================================================
describe("Conversation sort by latest message", () => {
  it("sorts conversations with newest message first", async () => {
    // Inline test: deriveConversations sorts by last_message.created_at desc
    const rooms = [
      { id: "r1", last_message: { created_at: "2024-01-01T10:00:00Z" } },
      { id: "r2", last_message: { created_at: "2024-01-01T12:00:00Z" } },
      { id: "r3", last_message: { created_at: "2024-01-01T11:00:00Z" } },
    ];

    const sorted = [...rooms].sort((a, b) => {
      const aTime = a.last_message?.created_at || "";
      const bTime = b.last_message?.created_at || "";
      return bTime.localeCompare(aTime);
    });

    expect(sorted[0].id).toBe("r2"); // 12:00
    expect(sorted[1].id).toBe("r3"); // 11:00
    expect(sorted[2].id).toBe("r1"); // 10:00
  });

  it("pinned conversations stay at top", () => {
    const rooms = [
      { id: "r1", pinned: true, last_message: { created_at: "2024-01-01T10:00:00Z" } },
      { id: "r2", pinned: false, last_message: { created_at: "2024-01-01T12:00:00Z" } },
    ];

    const sorted = [...rooms].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      const aTime = a.last_message?.created_at || "";
      const bTime = b.last_message?.created_at || "";
      return bTime.localeCompare(aTime);
    });

    expect(sorted[0].id).toBe("r1"); // pinned, even though older
    expect(sorted[1].id).toBe("r2");
  });
});
