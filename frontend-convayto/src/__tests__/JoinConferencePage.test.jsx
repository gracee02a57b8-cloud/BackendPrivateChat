// ==========================================
// JoinConferencePage.test.jsx — join conference via invite link tests
// ==========================================
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ====== Router mocks ======
const navigateMock = vi.fn();
let routeParams = { confId: "test-conf-123" };

vi.mock("react-router-dom", () => ({
  useParams: () => routeParams,
  useNavigate: () => navigateMock,
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}));

// ====== Conference context mock ======
const joinConferenceByIdMock = vi.fn();
const defaultConfCtx = {
  joinConferenceById: joinConferenceByIdMock,
  confState: "idle",
  CONF_STATE: { IDLE: "idle", JOINING: "joining", ACTIVE: "active" },
};
let confCtxMock = { ...defaultConfCtx };

vi.mock("../contexts/ConferenceContext", () => ({
  useConference: () => confCtxMock,
}));

// ====== Loader mock ======
vi.mock("../components/Loader", () => ({
  default: ({ text }) => <div data-testid="loader">{text}</div>,
}));

// ====== Toast mock ======
vi.mock("react-hot-toast", () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

// Import after mocks
import JoinConferencePage from "../components/JoinConferencePage";

describe("JoinConferencePage", () => {
  beforeEach(() => {
    confCtxMock = { ...defaultConfCtx };
    confCtxMock.joinConferenceById = joinConferenceByIdMock;
    routeParams = { confId: "test-conf-123" };
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();

    // Default: conference info fetch succeeds
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ count: 3, maxParticipants: 10 }),
      }),
    );
  });

  // ------------------------------------------
  // UNAUTHENTICATED — preview mode
  // ------------------------------------------
  describe("Unauthenticated user", () => {
    beforeEach(() => {
      localStorage.removeItem("token");
    });

    it("shows loading state initially", () => {
      // Fetch never resolves to keep loading state
      globalThis.fetch = vi.fn(() => new Promise(() => {}));
      render(<JoinConferencePage />);

      expect(screen.getByTestId("loader")).toBeInTheDocument();
      expect(screen.getByText("Загрузка...")).toBeInTheDocument();
    });

    it("shows conference preview after loading", async () => {
      render(<JoinConferencePage />);

      await waitFor(() => {
        expect(screen.getByText("Приглашение в конференцию")).toBeInTheDocument();
      });
    });

    it("shows participant count from API", async () => {
      render(<JoinConferencePage />);

      await waitFor(() => {
        expect(screen.getByText("Участников: 3 / 10")).toBeInTheDocument();
      });
    });

    it("shows login and register buttons", async () => {
      render(<JoinConferencePage />);

      await waitFor(() => {
        expect(screen.getByText("Войти")).toBeInTheDocument();
        expect(screen.getByText("Зарегистрироваться")).toBeInTheDocument();
      });
    });

    it("login link points to /signin", async () => {
      render(<JoinConferencePage />);

      await waitFor(() => {
        const loginLink = screen.getByText("Войти");
        expect(loginLink).toHaveAttribute("href", "/signin");
      });
    });

    it("register link points to /signup", async () => {
      render(<JoinConferencePage />);

      await waitFor(() => {
        const regLink = screen.getByText("Зарегистрироваться");
        expect(regLink).toHaveAttribute("href", "/signup");
      });
    });

    it("saves pendingConference to sessionStorage", async () => {
      render(<JoinConferencePage />);

      await waitFor(() => {
        expect(sessionStorage.getItem("pendingConference")).toBe("test-conf-123");
      });
    });

    it("shows video camera emoji", async () => {
      render(<JoinConferencePage />);

      await waitFor(() => {
        expect(screen.getByText("📹")).toBeInTheDocument();
      });
    });

    it("shows authorization required text", async () => {
      render(<JoinConferencePage />);

      await waitFor(() => {
        expect(
          screen.getByText(/Для подключения необходимо войти или зарегистрироваться/),
        ).toBeInTheDocument();
      });
    });
  });

  // ------------------------------------------
  // UNAUTHENTICATED — error state
  // ------------------------------------------
  describe("Unauthenticated — error state", () => {
    beforeEach(() => {
      localStorage.removeItem("token");
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({ ok: false }),
      );
    });

    it("shows error when conference not found", async () => {
      render(<JoinConferencePage />);

      await waitFor(() => {
        expect(
          screen.getByText("Конференция не найдена или уже завершилась"),
        ).toBeInTheDocument();
      });
    });

    it("shows error emoji", async () => {
      render(<JoinConferencePage />);

      await waitFor(() => {
        expect(screen.getByText("⚠️")).toBeInTheDocument();
      });
    });

    it("shows explanation text about expired link", async () => {
      render(<JoinConferencePage />);

      await waitFor(() => {
        expect(
          screen.getByText(/Конференция могла завершиться или ссылка недействительна/),
        ).toBeInTheDocument();
      });
    });
  });

  // ------------------------------------------
  // AUTHENTICATED — auto-join
  // ------------------------------------------
  describe("Authenticated user", () => {
    beforeEach(() => {
      localStorage.setItem("token", "valid-jwt-token");
    });

    it("shows loading while joining", async () => {
      // joinConferenceById never resolves
      joinConferenceByIdMock.mockReturnValue(new Promise(() => {}));
      render(<JoinConferencePage />);

      await waitFor(() => {
        expect(screen.getByTestId("loader")).toBeInTheDocument();
        expect(screen.getByText("Подключение к конференции...")).toBeInTheDocument();
      });
    });

    it("calls joinConferenceById with confId", async () => {
      joinConferenceByIdMock.mockResolvedValue("room-abc");
      render(<JoinConferencePage />);

      await waitFor(() => {
        expect(joinConferenceByIdMock).toHaveBeenCalledWith("test-conf-123");
      });
    });

    it("navigates to room after successful join", async () => {
      joinConferenceByIdMock.mockResolvedValue("room-abc");
      render(<JoinConferencePage />);

      await waitFor(() => {
        expect(navigateMock).toHaveBeenCalledWith("/chat/room/room-abc", {
          replace: true,
        });
      });
    });

    it("navigates to /chat when roomId is null", async () => {
      joinConferenceByIdMock.mockResolvedValue(null);
      render(<JoinConferencePage />);

      await waitFor(() => {
        expect(navigateMock).toHaveBeenCalledWith("/chat", { replace: true });
      });
    });

    it("shows error when join fails", async () => {
      joinConferenceByIdMock.mockRejectedValue(
        new Error("Не удалось присоединиться к конференции"),
      );
      render(<JoinConferencePage />);

      await waitFor(() => {
        expect(
          screen.getByText(/Не удалось присоединиться к конференции/),
        ).toBeInTheDocument();
      });
    });

    it("shows 'Вернуться в чат' button on error", async () => {
      joinConferenceByIdMock.mockRejectedValue(new Error("Error"));
      render(<JoinConferencePage />);

      await waitFor(() => {
        expect(screen.getByText("Вернуться в чат")).toBeInTheDocument();
      });
    });

    it("'Вернуться в чат' button navigates to /chat", async () => {
      joinConferenceByIdMock.mockRejectedValue(new Error("Error"));
      render(<JoinConferencePage />);

      await waitFor(() => {
        expect(screen.getByText("Вернуться в чат")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText("Вернуться в чат"));
      expect(navigateMock).toHaveBeenCalledWith("/chat", { replace: true });
    });

    it("fetches conference info from API", async () => {
      joinConferenceByIdMock.mockResolvedValue("room-abc");
      render(<JoinConferencePage />);

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/conference/test-conf-123/info"),
        );
      });
    });
  });

  // ------------------------------------------
  // EDGE CASES
  // ------------------------------------------
  describe("Edge cases", () => {
    it("does not call joinConferenceById twice", async () => {
      localStorage.setItem("token", "jwt");
      joinConferenceByIdMock.mockResolvedValue("room-abc");

      const { rerender } = render(<JoinConferencePage />);

      await waitFor(() => {
        expect(joinConferenceByIdMock).toHaveBeenCalledTimes(1);
      });

      // Re-render should not trigger second join
      rerender(<JoinConferencePage />);
      expect(joinConferenceByIdMock).toHaveBeenCalledTimes(1);
    });
  });
});
