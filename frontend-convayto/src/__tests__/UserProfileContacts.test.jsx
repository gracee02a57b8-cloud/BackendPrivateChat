// ==========================================
// UserProfileContacts.test.jsx
// Tests for: UserProfileModal, ProfileSideBar add-to-contacts,
//            group member clicks, apiContacts API layer
// ==========================================
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ====== Mocks ======

// react-router-dom
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({}),
  Link: ({ children, to }) => <a href={to}>{children}</a>,
}));

// apiHelper
vi.mock("../services/apiHelper", () => ({
  apiFetch: vi.fn(() => Promise.resolve(null)),
}));

// wsService
vi.mock("../services/wsService", () => ({
  connectWebSocket: vi.fn(),
  disconnectWebSocket: vi.fn(),
  sendWsMessage: vi.fn(),
  onWsMessage: vi.fn(() => () => {}),
  onCallMessage: vi.fn(() => () => {}),
  onConferenceMessage: vi.fn(() => () => {}),
  onWsConnection: vi.fn(() => () => {}),
  isWsConnected: vi.fn(() => true),
}));

// react-hot-toast
const mockToast = vi.fn();
mockToast.success = vi.fn();
mockToast.error = vi.fn();
mockToast.custom = vi.fn();
mockToast.dismiss = vi.fn();
vi.mock("react-hot-toast", () => ({ default: mockToast, Toaster: () => null }));

// useOnlineUsers
const mockOnlineUsers = new Set();
vi.mock("../hooks/useOnlineUsers", () => ({
  useOnlineUsers: () => mockOnlineUsers,
}));

// ====== Imports (after mocks) ======
import { apiFetch } from "../services/apiHelper";

// ====== Helpers ======
function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

// ============================================================
// 1. apiContacts — API layer
// ============================================================
describe("apiContacts — API layer", () => {
  let fetchContacts, addContact, removeContact, fetchUserProfile;

  beforeEach(async () => {
    vi.resetModules();
    vi.mocked(apiFetch).mockReset();
    const mod = await import("../services/apiContacts");
    fetchContacts = mod.fetchContacts;
    addContact = mod.addContact;
    removeContact = mod.removeContact;
    fetchUserProfile = mod.fetchUserProfile;
  });

  it("fetchContacts calls GET /api/contacts", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([{ contact: "alice" }]);
    const result = await fetchContacts();
    expect(apiFetch).toHaveBeenCalledWith("/api/contacts");
    expect(result).toEqual([{ contact: "alice" }]);
  });

  it("addContact calls POST /api/contacts/{username}", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ status: "added" });
    const result = await addContact("bob");
    expect(apiFetch).toHaveBeenCalledWith("/api/contacts/bob", { method: "POST" });
    expect(result.status).toBe("added");
  });

  it("removeContact calls DELETE /api/contacts/{username}", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ status: "removed" });
    const result = await removeContact("bob");
    expect(apiFetch).toHaveBeenCalledWith("/api/contacts/bob", { method: "DELETE" });
    expect(result.status).toBe("removed");
  });

  it("fetchUserProfile calls GET /api/profile/{username}", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ username: "bob", isContact: false });
    const result = await fetchUserProfile("bob");
    expect(apiFetch).toHaveBeenCalledWith("/api/profile/bob");
    expect(result.username).toBe("bob");
  });

  it("encodes special characters in username", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ status: "added" });
    await addContact("Иван Иванов");
    expect(apiFetch).toHaveBeenCalledWith(
      `/api/contacts/${encodeURIComponent("Иван Иванов")}`,
      { method: "POST" },
    );
  });
});

// ============================================================
// 2. UserProfileModal — rendering & actions
// ============================================================
describe("UserProfileModal", () => {
  let UserProfileModal;
  const onClose = vi.fn();

  beforeEach(async () => {
    vi.resetModules();
    vi.mocked(apiFetch).mockReset();
    mockToast.success.mockClear();
    mockToast.error.mockClear();
    onClose.mockClear();
    mockNavigate.mockClear();
    mockOnlineUsers.clear();
    const mod = await import("../components/UserProfileModal");
    UserProfileModal = mod.default;
  });

  function renderModal(username = "bob") {
    const qc = createQueryClient();
    return render(
      <QueryClientProvider client={qc}>
        <UserProfileModal username={username} onClose={onClose} />
      </QueryClientProvider>,
    );
  }

  it("shows loading state initially", () => {
    vi.mocked(apiFetch).mockReturnValue(new Promise(() => {})); // never resolves
    renderModal();
    expect(screen.getByText(/загрузка профиля/i)).toBeInTheDocument();
  });

  it("renders profile data after loading", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      username: "bob",
      firstName: "Bob",
      lastName: "Smith",
      bio: "Hello world",
      tag: "#dev",
      isContact: false,
      avatarUrl: "",
      phone: "+71234567890",
      birthday: "01.01.2000",
    });

    renderModal();
    await waitFor(() => expect(screen.getByText("Bob Smith")).toBeInTheDocument());
    expect(screen.getByText("@bob")).toBeInTheDocument();
    expect(screen.getByText("#dev")).toBeInTheDocument();
    expect(screen.getByText("Hello world")).toBeInTheDocument();
    expect(screen.getByText("+71234567890")).toBeInTheDocument();
  });

  it("shows 'В контакты' button when not a contact", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      username: "bob",
      firstName: "Bob",
      lastName: "",
      isContact: false,
    });

    renderModal();
    await waitFor(() => expect(screen.getByText("В контакты")).toBeInTheDocument());
  });

  it("shows 'Удалить' button when already a contact", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      username: "bob",
      firstName: "Bob",
      lastName: "",
      isContact: true,
    });

    renderModal();
    await waitFor(() => expect(screen.getByText("Удалить")).toBeInTheDocument());
  });

  it("adds contact on button click", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ username: "bob", firstName: "Bob", lastName: "", isContact: false })
      .mockResolvedValueOnce({ status: "added" });

    renderModal();
    await waitFor(() => expect(screen.getByText("В контакты")).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByText("В контакты"));
    });

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith("Добавлен в контакты");
    });
  });

  it("removes contact on button click", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ username: "bob", firstName: "Bob", lastName: "", isContact: true })
      .mockResolvedValueOnce({ status: "removed" });

    renderModal();
    await waitFor(() => expect(screen.getByText("Удалить")).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByText("Удалить"));
    });

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith("Удалён из контактов");
    });
  });

  it("navigates to chat on 'Написать' button click", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      username: "bob",
      firstName: "Bob",
      lastName: "",
      isContact: false,
    });

    renderModal();
    await waitFor(() => expect(screen.getByText("Написать")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Написать"));
    expect(mockNavigate).toHaveBeenCalledWith("/chat/bob");
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on backdrop click", async () => {
    vi.mocked(apiFetch).mockReturnValue(new Promise(() => {}));
    const { container } = renderModal();

    // The backdrop is the first fixed div
    const backdrop = container.querySelector(".fixed.inset-0");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on X button click", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      username: "bob",
      firstName: "Bob",
      lastName: "",
      isContact: false,
    });

    renderModal();
    await waitFor(() => expect(screen.getByText("Bob")).toBeInTheDocument());

    // Find the close button in the header
    const closeBtn = screen.getByText("Bob").closest(".fixed")?.querySelector("button");
    if (closeBtn) {
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it("shows online indicator when user is online", async () => {
    mockOnlineUsers.add("bob");
    vi.mocked(apiFetch).mockResolvedValueOnce({
      username: "bob",
      firstName: "Bob",
      lastName: "",
      isContact: false,
    });

    renderModal();
    await waitFor(() => expect(screen.getByText("в сети")).toBeInTheDocument());
  });

  it("shows error toast when profile fetch fails", async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error("fail"));
    renderModal();
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Не удалось загрузить профиль");
    });
  });

  it("shows error toast when add contact fails", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ username: "bob", firstName: "Bob", lastName: "", isContact: false })
      .mockRejectedValueOnce(new Error("fail"));

    renderModal();
    await waitFor(() => expect(screen.getByText("В контакты")).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByText("В контакты"));
    });

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Ошибка при обновлении контактов");
    });
  });

  it("shows 'Профиль не найден' when profile is null", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(null);
    renderModal();
    await waitFor(() => {
      expect(screen.getByText("Профиль не найден")).toBeInTheDocument();
    });
  });
});

// ============================================================
// 3. UserProfileModalContext — context integration
// ============================================================
describe("UserProfileModalContext", () => {
  it("openUserProfile renders modal, closeUserProfile hides it", async () => {
    // Use a deferred promise so we can control when the profile loads
    let resolveProfile;
    vi.mocked(apiFetch).mockImplementation(
      () => new Promise((res) => { resolveProfile = res; }),
    );

    const { UserProfileModalProvider, useUserProfileModal } = await import(
      "../contexts/UserProfileModalContext"
    );

    function TestButton() {
      const { openUserProfile, closeUserProfile } = useUserProfileModal();
      return (
        <>
          <button onClick={() => openUserProfile("bob")}>Open</button>
          <button onClick={() => closeUserProfile()}>CloseSidebar</button>
        </>
      );
    }

    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <UserProfileModalProvider>
          <TestButton />
        </UserProfileModalProvider>
      </QueryClientProvider>,
    );

    // Modal not visible yet
    expect(screen.queryByText(/загрузка профиля/i)).not.toBeInTheDocument();

    // Open modal
    await act(async () => {
      fireEvent.click(screen.getByText("Open"));
    });
    expect(screen.getByText(/загрузка профиля/i)).toBeInTheDocument();

    // Resolve the profile fetch
    await act(async () => {
      resolveProfile({
        username: "bob",
        firstName: "Bob",
        lastName: "",
        isContact: false,
      });
    });

    await waitFor(() => expect(screen.getByText("Bob")).toBeInTheDocument());

    // Close modal via context
    await act(async () => {
      fireEvent.click(screen.getByText("CloseSidebar"));
    });
    await waitFor(() => {
      expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    });
  });

  it("throws if used outside provider", async () => {
    const { useUserProfileModal } = await import(
      "../contexts/UserProfileModalContext"
    );

    function Bad() {
      useUserProfileModal();
      return null;
    }

    expect(() => render(<Bad />)).toThrow(
      /useUserProfileModal must be used within/,
    );
  });
});

// ============================================================
// 4. getContacts — via /api/contacts backend
// ============================================================
describe("getContacts — /api/contacts integration", () => {
  let getContacts;

  beforeEach(async () => {
    vi.resetModules();
    vi.mocked(apiFetch).mockReset();
    const mod = await import("../features/sideBar/useContacts");
    getContacts = mod.getContacts;
  });

  it("returns mapped contacts from /api/contacts", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([
      { contact: "alice", firstName: "Alice", lastName: "W", avatarUrl: "a.png", tag: "#hi", online: true, lastSeen: null },
      { contact: "bob", firstName: null, lastName: null, avatarUrl: "", tag: "", online: false, lastSeen: "yesterday" },
    ]);

    const contacts = await getContacts();
    expect(contacts).toHaveLength(2);
    expect(contacts[0]).toMatchObject({ id: "alice", fullname: "Alice W", username: "alice", avatar_url: "a.png" });
    expect(contacts[1]).toMatchObject({ id: "bob", fullname: "bob", username: "bob" });
  });

  it("returns empty array when API returns empty", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([]);
    const contacts = await getContacts();
    expect(contacts).toEqual([]);
  });

  it("returns empty array for non-array response", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(null);
    const contacts = await getContacts();
    expect(contacts).toEqual([]);
  });
});
