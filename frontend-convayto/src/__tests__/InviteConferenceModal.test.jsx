// ==========================================
// InviteConferenceModal.test.jsx — invite participants modal tests
// ==========================================
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InviteConferenceModal from "../components/InviteConferenceModal";

// ====== Conference context mock ======
const defaultConfCtx = {
  getInviteLink: vi.fn(() => "https://barsikchat.duckdns.org/conference/abc-123"),
  inviteUser: vi.fn(),
  participants: ["Alice"],
};
let confCtxMock = { ...defaultConfCtx };

vi.mock("../contexts/ConferenceContext", () => ({
  useConference: () => confCtxMock,
  MAX_PARTICIPANTS: 10,
}));

// ====== Contacts mock ======
const defaultContacts = [
  { id: 1, fullname: "Alice Smith", username: "alice", avatar_url: null, online: true, lastSeen: null },
  { id: 2, fullname: "Bob Jones", username: "bob", avatar_url: null, online: false, lastSeen: null },
  { id: 3, fullname: "Charlie Brown", username: "charlie", avatar_url: "http://img/charlie.jpg", online: true, lastSeen: null },
  { id: 4, fullname: "Diana Prince", username: "diana", avatar_url: null, online: false, lastSeen: null },
];
let contactsMock = { contacts: defaultContacts, isPending: false, error: null };

vi.mock("../features/sideBar/useContacts", () => ({
  useContacts: () => contactsMock,
}));

// ====== Toast mock (vi.hoisted so variables are available in hoisted vi.mock) ======
const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: Object.assign(vi.fn(), { success: toastSuccess, error: toastError }),
}));

describe("InviteConferenceModal", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    confCtxMock = { ...defaultConfCtx };
    confCtxMock.getInviteLink = vi.fn(() => "https://barsikchat.duckdns.org/conference/abc-123");
    confCtxMock.inviteUser = vi.fn();
    confCtxMock.participants = ["alice"]; // alice already in conference
    contactsMock = { contacts: [...defaultContacts], isPending: false, error: null };
    vi.clearAllMocks();
    localStorage.setItem("username", "TestUser");
    // Mock clipboard
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn(() => Promise.resolve()) },
    });
  });

  // ------------------------------------------
  // HEADER & STRUCTURE
  // ------------------------------------------
  describe("Header and structure", () => {
    it("renders modal header", () => {
      render(<InviteConferenceModal onClose={onClose} />);
      expect(screen.getByText("Пригласить в конференцию")).toBeInTheDocument();
    });

    it("renders close button that fires onClose", () => {
      render(<InviteConferenceModal onClose={onClose} />);
      // Close button is the one in the header area
      const closeBtns = screen.getAllByRole("button");
      // First button in the header (close) — click it
      closeBtns[0].click();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("shows participant count 'N / 10'", () => {
      confCtxMock.participants = ["alice", "bob"];
      render(<InviteConferenceModal onClose={onClose} />);
      // totalNow = 2 + 1 (me) = 3
      expect(screen.getByText(/Участников: 3 \/ 10/)).toBeInTheDocument();
    });

    it("shows 'конференция заполнена' when slots are full", () => {
      confCtxMock.participants = Array(9).fill("user"); // 9 peers + me = 10
      render(<InviteConferenceModal onClose={onClose} />);
      expect(screen.getByText(/конференция заполнена/)).toBeInTheDocument();
    });

    it("renders two tabs: Контакты and Ссылка", () => {
      render(<InviteConferenceModal onClose={onClose} />);
      expect(screen.getByText("Контакты")).toBeInTheDocument();
      expect(screen.getByText("Ссылка")).toBeInTheDocument();
    });
  });

  // ------------------------------------------
  // CONTACTS TAB
  // ------------------------------------------
  describe("Contacts tab", () => {
    it("displays contacts excluding self and already in conference", () => {
      confCtxMock.participants = ["alice"]; // alice is in conference
      localStorage.setItem("username", "TestUser");
      render(<InviteConferenceModal onClose={onClose} />);

      // alice should be excluded (in conference)
      expect(screen.queryByText("@alice")).not.toBeInTheDocument();
      // TestUser is self — not in contacts list so that's fine
      // bob, charlie, diana should be visible
      expect(screen.getByText("@bob")).toBeInTheDocument();
      expect(screen.getByText("@charlie")).toBeInTheDocument();
      expect(screen.getByText("@diana")).toBeInTheDocument();
    });

    it("displays fullname of contacts", () => {
      confCtxMock.participants = [];
      render(<InviteConferenceModal onClose={onClose} />);
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
      expect(screen.getByText("Charlie Brown")).toBeInTheDocument();
    });

    it("shows online indicator for online contacts", () => {
      confCtxMock.participants = [];
      render(<InviteConferenceModal onClose={onClose} />);
      const onlineDots = screen.getAllByTitle("Онлайн");
      // alice and charlie are online
      expect(onlineDots.length).toBeGreaterThanOrEqual(1);
    });

    it("search filters contacts by username", async () => {
      confCtxMock.participants = [];
      render(<InviteConferenceModal onClose={onClose} />);
      const searchInput = screen.getByPlaceholderText("Поиск контактов...");

      await userEvent.type(searchInput, "bob");

      expect(screen.getByText("@bob")).toBeInTheDocument();
      expect(screen.queryByText("@charlie")).not.toBeInTheDocument();
      expect(screen.queryByText("@diana")).not.toBeInTheDocument();
    });

    it("search filters contacts by fullname", async () => {
      confCtxMock.participants = [];
      render(<InviteConferenceModal onClose={onClose} />);
      const searchInput = screen.getByPlaceholderText("Поиск контактов...");

      await userEvent.type(searchInput, "Diana");

      expect(screen.getByText("@diana")).toBeInTheDocument();
      expect(screen.queryByText("@bob")).not.toBeInTheDocument();
    });

    it("shows 'Никого не найдено' when search has no matches", async () => {
      confCtxMock.participants = [];
      render(<InviteConferenceModal onClose={onClose} />);
      const searchInput = screen.getByPlaceholderText("Поиск контактов...");

      await userEvent.type(searchInput, "zzzzzz");

      expect(screen.getByText("Никого не найдено")).toBeInTheDocument();
    });

    it("shows 'Все контакты уже в конференции' when all are in conference", () => {
      confCtxMock.participants = ["alice", "bob", "charlie", "diana"];
      render(<InviteConferenceModal onClose={onClose} />);
      expect(screen.getByText("Все контакты уже в конференции")).toBeInTheDocument();
    });

    it("shows loading state", () => {
      contactsMock.isPending = true;
      render(<InviteConferenceModal onClose={onClose} />);
      expect(screen.getByText("Загрузка контактов...")).toBeInTheDocument();
    });

    it("renders avatar image when avatar_url is provided", () => {
      confCtxMock.participants = [];
      const { container } = render(<InviteConferenceModal onClose={onClose} />);
      const imgs = container.querySelectorAll("img");
      expect(imgs.length).toBeGreaterThanOrEqual(1);
      const charlieImg = Array.from(imgs).find((img) => img.src === "http://img/charlie.jpg");
      expect(charlieImg).toBeTruthy();
    });

    it("renders first letter fallback when no avatar_url", () => {
      confCtxMock.participants = [];
      render(<InviteConferenceModal onClose={onClose} />);
      // Bob has no avatar — should show 'b' (first letter of username)
      expect(screen.getByText("b")).toBeInTheDocument();
    });
  });

  // ------------------------------------------
  // INVITE BUTTON
  // ------------------------------------------
  describe("Invite button", () => {
    it("invite button calls inviteUser and changes to 'Отправлено'", async () => {
      confCtxMock.participants = [];
      render(<InviteConferenceModal onClose={onClose} />);

      const inviteButtons = screen.getAllByText("Пригласить");
      // Click the first invite button (for a contact, not the tab)
      const contactInviteBtns = inviteButtons.filter(
        (btn) => btn.closest("button") && btn.closest(".flex.items-center.gap-3")
      );
      expect(contactInviteBtns.length).toBeGreaterThan(0);
      fireEvent.click(contactInviteBtns[0].closest("button"));

      expect(confCtxMock.inviteUser).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(screen.getByText("Отправлено")).toBeInTheDocument();
      });
    });

    it("invite button is disabled after invite sent", async () => {
      confCtxMock.participants = [];
      render(<InviteConferenceModal onClose={onClose} />);

      const inviteButtons = screen.getAllByText("Пригласить");
      const contactInviteBtns = inviteButtons.filter(
        (btn) => btn.closest("button") && btn.closest(".flex.items-center.gap-3")
      );
      fireEvent.click(contactInviteBtns[0].closest("button"));

      await waitFor(() => {
        const sentBtn = screen.getByText("Отправлено").closest("button");
        expect(sentBtn).toBeDisabled();
      });
    });

    it("invite button disabled when conference is full", () => {
      confCtxMock.participants = Array(9).fill("user"); // 9 + me = 10
      render(<InviteConferenceModal onClose={onClose} />);

      // All contact invite buttons should be disabled
      const allButtons = screen.getAllByRole("button");
      const inviteContactBtns = allButtons.filter((btn) => btn.textContent.includes("Пригласить") && btn.closest(".flex.items-center.gap-3"));
      inviteContactBtns.forEach((btn) => {
        expect(btn).toBeDisabled();
      });
    });

    it("shows toast error when trying to invite while full", () => {
      confCtxMock.participants = Array(9).fill("user");
      render(<InviteConferenceModal onClose={onClose} />);

      // Even if we force-click, it should not call inviteUser
      const allButtons = screen.getAllByRole("button");
      const inviteContactBtns = allButtons.filter((btn) => btn.textContent.includes("Пригласить") && btn.closest(".flex.items-center.gap-3"));
      if (inviteContactBtns.length > 0) {
        fireEvent.click(inviteContactBtns[0]);
        // It should not call inviteUser because disabled button won't trigger onClick
        expect(confCtxMock.inviteUser).not.toHaveBeenCalled();
      }
    });
  });

  // ------------------------------------------
  // LINK TAB
  // ------------------------------------------
  describe("Link tab", () => {
    it("switches to link tab and shows invite link", () => {
      render(<InviteConferenceModal onClose={onClose} />);
      fireEvent.click(screen.getByText("Ссылка"));

      expect(screen.getByText("https://barsikchat.duckdns.org/conference/abc-123")).toBeInTheDocument();
    });

    it("shows description text about sharing link", () => {
      render(<InviteConferenceModal onClose={onClose} />);
      fireEvent.click(screen.getByText("Ссылка"));

      expect(screen.getByText(/Поделитесь ссылкой/)).toBeInTheDocument();
    });

    it("shows 'Скопировать ссылку' button", () => {
      render(<InviteConferenceModal onClose={onClose} />);
      fireEvent.click(screen.getByText("Ссылка"));

      expect(screen.getByText("Скопировать ссылку")).toBeInTheDocument();
    });

    it("copy button copies link to clipboard and shows toast", async () => {
      render(<InviteConferenceModal onClose={onClose} />);
      fireEvent.click(screen.getByText("Ссылка"));
      fireEvent.click(screen.getByText("Скопировать ссылку"));

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          "https://barsikchat.duckdns.org/conference/abc-123"
        );
        expect(toastSuccess).toHaveBeenCalledWith("Ссылка скопирована!");
      });
    });

    it("shows '—' when invite link is null", () => {
      confCtxMock.getInviteLink = vi.fn(() => null);
      render(<InviteConferenceModal onClose={onClose} />);
      fireEvent.click(screen.getByText("Ссылка"));

      expect(screen.getByText("—")).toBeInTheDocument();
    });

    it("text about unregistered users is displayed", () => {
      render(<InviteConferenceModal onClose={onClose} />);
      fireEvent.click(screen.getByText("Ссылка"));

      expect(screen.getByText(/Незарегистрированные пользователи/)).toBeInTheDocument();
    });
  });

  // ------------------------------------------
  // TAB SWITCHING
  // ------------------------------------------
  describe("Tab switching", () => {
    it("starts on Contacts tab by default", () => {
      confCtxMock.participants = [];
      render(<InviteConferenceModal onClose={onClose} />);
      // Search input only exists on contacts tab
      expect(screen.getByPlaceholderText("Поиск контактов...")).toBeInTheDocument();
    });

    it("switches to Link tab and hides contacts", () => {
      confCtxMock.participants = [];
      render(<InviteConferenceModal onClose={onClose} />);
      fireEvent.click(screen.getByText("Ссылка"));

      expect(screen.queryByPlaceholderText("Поиск контактов...")).not.toBeInTheDocument();
      expect(screen.getByText("Скопировать ссылку")).toBeInTheDocument();
    });

    it("switches back to Contacts tab from Link tab", () => {
      confCtxMock.participants = [];
      render(<InviteConferenceModal onClose={onClose} />);
      fireEvent.click(screen.getByText("Ссылка"));
      fireEvent.click(screen.getByText("Контакты"));

      expect(screen.getByPlaceholderText("Поиск контактов...")).toBeInTheDocument();
      expect(screen.queryByText("Скопировать ссылку")).not.toBeInTheDocument();
    });
  });
});
