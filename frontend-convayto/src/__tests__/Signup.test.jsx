// ==========================================
// Signup.test.jsx — tests for registration page with fullname field
// ==========================================
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ====== Mocks ======

const navigateMock = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
  Link: ({ children, to }) => <a href={to}>{children}</a>,
}));

let signupMock = vi.fn();
let isPendingMock = false;
let isSuccessMock = false;
vi.mock("../features/authentication/useSignup", () => ({
  useSignup: () => ({
    signup: signupMock,
    isPending: isPendingMock,
    isSuccess: isSuccessMock,
  }),
}));

let isAuthenticatedMock = false;
vi.mock("../features/authentication/useUser", () => ({
  useUser: () => ({
    isAuthenticated: isAuthenticatedMock,
  }),
}));

vi.mock("../config", () => ({
  APP_NAME: "BarsikChat",
  MIN_USERNAME_LENGTH: 3,
  MAX_USERNAME_LENGTH: 20,
  MIN_PASSWORD_LENGTH: 8,
  USERNAME_REGEX: /^.+$/,
}));

import Signup from "../features/authentication/Signup";

describe("Signup", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    signupMock = vi.fn();
    isPendingMock = false;
    isSuccessMock = false;
    isAuthenticatedMock = false;
  });

  // ------------------------------------------
  // RENDERING
  // ------------------------------------------
  describe("Rendering", () => {
    it("renders registration heading", () => {
      render(<Signup />);
      expect(screen.getByText("Регистрация")).toBeInTheDocument();
    });

    it("renders fullname (Имя) input field", () => {
      render(<Signup />);
      expect(screen.getByLabelText("Имя")).toBeInTheDocument();
    });

    it("renders login (Логин) input field", () => {
      render(<Signup />);
      expect(screen.getByLabelText("Логин")).toBeInTheDocument();
    });

    it("renders tag input field", () => {
      render(<Signup />);
      expect(screen.getByLabelText("Тег (@yourtag)")).toBeInTheDocument();
    });

    it("renders password input field", () => {
      render(<Signup />);
      expect(screen.getByLabelText("Пароль")).toBeInTheDocument();
    });

    it("renders confirm password input field", () => {
      render(<Signup />);
      expect(screen.getByLabelText("Подтвердите пароль")).toBeInTheDocument();
    });

    it("renders submit button", () => {
      render(<Signup />);
      expect(screen.getByRole("button", { name: /зарегистрироваться/i })).toBeInTheDocument();
    });

    it("renders link to signin page", () => {
      render(<Signup />);
      expect(screen.getByText("Войти")).toBeInTheDocument();
    });

    it("sets document title", () => {
      render(<Signup />);
      expect(document.title).toBe("BarsikChat — Регистрация");
    });
  });

  // ------------------------------------------
  // FULLNAME FIELD (arbitrary display name)
  // ------------------------------------------
  describe("Fullname field allows arbitrary names", () => {
    it("accepts Cyrillic characters", async () => {
      const user = userEvent.setup();
      render(<Signup />);

      const fullnameInput = screen.getByLabelText("Имя");
      await user.type(fullnameInput, "Алексей Петров");
      expect(fullnameInput).toHaveValue("Алексей Петров");
    });

    it("accepts mixed Latin and Cyrillic with spaces", async () => {
      const user = userEvent.setup();
      render(<Signup />);

      const fullnameInput = screen.getByLabelText("Имя");
      await user.type(fullnameInput, "Иван Ivan 123");
      expect(fullnameInput).toHaveValue("Иван Ivan 123");
    });

    it("shows error when fullname is too short", async () => {
      const user = userEvent.setup();
      render(<Signup />);

      await user.type(screen.getByLabelText("Имя"), "А");
      fireEvent.blur(screen.getByLabelText("Имя"));

      await waitFor(() => {
        expect(screen.getByText("Минимум 2 символа.")).toBeInTheDocument();
      });
    });

    it("shows error when fullname is empty on submit", async () => {
      const user = userEvent.setup();
      render(<Signup />);

      // Fill all other fields but not fullname
      await user.type(screen.getByLabelText("Логин"), "testuser");
      await user.type(screen.getByLabelText("Тег (@yourtag)"), "mytag");
      await user.type(screen.getByLabelText("Пароль"), "password123");
      await user.type(screen.getByLabelText("Подтвердите пароль"), "password123");

      fireEvent.click(screen.getByRole("button", { name: /зарегистрироваться/i }));

      await waitFor(() => {
        expect(screen.getByText("Введите имя.")).toBeInTheDocument();
      });
      expect(signupMock).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // LOGIN FIELD VALIDATION (any characters allowed)
  // ------------------------------------------
  describe("Login field validation", () => {
    it("accepts Cyrillic characters in login", async () => {
      const user = userEvent.setup();
      render(<Signup />);

      const loginInput = screen.getByLabelText("Логин");
      await user.type(loginInput, "Алексей");
      fireEvent.blur(loginInput);

      await waitFor(() => {
        expect(loginInput).toHaveValue("Алексей");
        expect(screen.queryByText("Логин не может быть пустым.")).not.toBeInTheDocument();
      });
    });

    it("accepts uppercase Latin characters in login", async () => {
      const user = userEvent.setup();
      render(<Signup />);

      const loginInput = screen.getByLabelText("Логин");
      await user.type(loginInput, "TestUser");
      fireEvent.blur(loginInput);

      await waitFor(() => {
        expect(loginInput).toHaveValue("TestUser");
        expect(screen.queryByText("Логин не может быть пустым.")).not.toBeInTheDocument();
      });
    });

    it("accepts mixed Cyrillic, Latin, numbers, and special chars in login", async () => {
      const user = userEvent.setup();
      render(<Signup />);

      const loginInput = screen.getByLabelText("Логин");
      await user.type(loginInput, "Иван_Ivan-123");
      fireEvent.blur(loginInput);

      await waitFor(() => {
        expect(loginInput).toHaveValue("Иван_Ivan-123");
      });
    });

    it("shows error for short login", async () => {
      const user = userEvent.setup();
      render(<Signup />);

      await user.type(screen.getByLabelText("Логин"), "ab");
      fireEvent.blur(screen.getByLabelText("Логин"));

      await waitFor(() => {
        expect(screen.getByText("Минимум 3 символа.")).toBeInTheDocument();
      });
    });

    it("accepts lowercase, numbers, underscores, hyphens", async () => {
      const user = userEvent.setup();
      render(<Signup />);

      const loginInput = screen.getByLabelText("Логин");
      await user.type(loginInput, "my_user-123");
      fireEvent.blur(loginInput);

      await waitFor(() => {
        expect(screen.queryByText("Логин не может быть пустым.")).not.toBeInTheDocument();
      });
    });
  });

  // ------------------------------------------
  // PASSWORD VALIDATION
  // ------------------------------------------
  describe("Password validation", () => {
    it("shows error for short password", async () => {
      const user = userEvent.setup();
      render(<Signup />);

      await user.type(screen.getByLabelText("Пароль"), "short");
      fireEvent.blur(screen.getByLabelText("Пароль"));

      await waitFor(() => {
        expect(screen.getByText("Минимум 8 символов.")).toBeInTheDocument();
      });
    });

    it("shows error when passwords don't match", async () => {
      const user = userEvent.setup();
      render(<Signup />);

      await user.type(screen.getByLabelText("Пароль"), "password123");
      await user.type(screen.getByLabelText("Подтвердите пароль"), "different");
      fireEvent.blur(screen.getByLabelText("Подтвердите пароль"));

      await waitFor(() => {
        expect(screen.getByText("Пароли не совпадают.")).toBeInTheDocument();
      });
    });
  });

  // ------------------------------------------
  // SUCCESSFUL REGISTRATION
  // ------------------------------------------
  describe("Successful registration", () => {
    it("calls signup with fullname, username, password, tag", async () => {
      const user = userEvent.setup();
      render(<Signup />);

      await user.type(screen.getByLabelText("Имя"), "Алексей Петров");
      await user.type(screen.getByLabelText("Логин"), "Алексей_Alex");
      await user.type(screen.getByLabelText("Тег (@yourtag)"), "alexey_p");
      await user.type(screen.getByLabelText("Пароль"), "secret12345");
      await user.type(screen.getByLabelText("Подтвердите пароль"), "secret12345");
      fireEvent.click(screen.getByRole("button", { name: /зарегистрироваться/i }));

      await waitFor(() => {
        expect(signupMock).toHaveBeenCalledTimes(1);
      });
      const args = signupMock.mock.calls[0][0];
      expect(args.fullname).toBe("Алексей Петров");
      expect(args.username).toBe("Алексей_Alex");
      expect(args.tag).toBe("alexey_p");
      expect(args.password).toBe("secret12345");
    });

    it("trims whitespace from fullname, username, tag before submitting", async () => {
      const user = userEvent.setup();
      render(<Signup />);

      await user.type(screen.getByLabelText("Имя"), "  Иван  ");
      await user.type(screen.getByLabelText("Логин"), "ivan");
      await user.type(screen.getByLabelText("Тег (@yourtag)"), " ivan_tag ");
      await user.type(screen.getByLabelText("Пароль"), "password123");
      await user.type(screen.getByLabelText("Подтвердите пароль"), "password123");
      fireEvent.click(screen.getByRole("button", { name: /зарегистрироваться/i }));

      await waitFor(() => {
        expect(signupMock).toHaveBeenCalledTimes(1);
      });
      const args = signupMock.mock.calls[0][0];
      expect(args.fullname).toBe("Иван");
      expect(args.username).toBe("ivan");
      expect(args.tag).toBe("ivan_tag");
    });
  });

  // ------------------------------------------
  // TAG VALIDATION
  // ------------------------------------------
  describe("Tag validation", () => {
    it("shows error when tag is empty on submit", async () => {
      const user = userEvent.setup();
      render(<Signup />);

      await user.type(screen.getByLabelText("Имя"), "Test User");
      await user.type(screen.getByLabelText("Логин"), "testuser");
      await user.type(screen.getByLabelText("Пароль"), "password123");
      await user.type(screen.getByLabelText("Подтвердите пароль"), "password123");
      fireEvent.click(screen.getByRole("button", { name: /зарегистрироваться/i }));

      await waitFor(() => {
        expect(screen.getByText("Введите тег.")).toBeInTheDocument();
      });
      expect(signupMock).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // LOADING STATE
  // ------------------------------------------
  describe("Loading state", () => {
    it("shows loading text when isPending", () => {
      isPendingMock = true;
      render(<Signup />);
      expect(screen.getByText("Регистрация...")).toBeInTheDocument();
    });

    it("disables all inputs when isPending", () => {
      isPendingMock = true;
      render(<Signup />);
      expect(screen.getByLabelText("Имя")).toBeDisabled();
      expect(screen.getByLabelText("Логин")).toBeDisabled();
      expect(screen.getByLabelText("Тег (@yourtag)")).toBeDisabled();
      expect(screen.getByLabelText("Пароль")).toBeDisabled();
      expect(screen.getByLabelText("Подтвердите пароль")).toBeDisabled();
    });
  });

  // ------------------------------------------
  // REDIRECT AFTER SUCCESS / ALREADY AUTHENTICATED
  // ------------------------------------------
  describe("Redirect", () => {
    it("navigates to /chat when isSuccess becomes true", () => {
      isSuccessMock = true;
      render(<Signup />);
      expect(navigateMock).toHaveBeenCalledWith("/chat", { replace: true });
    });

    it("navigates to /chat if already authenticated", () => {
      isAuthenticatedMock = true;
      render(<Signup />);
      expect(navigateMock).toHaveBeenCalledWith("/chat", { replace: true });
    });

    it("navigates to pending conference after success", () => {
      sessionStorage.setItem("pendingConference", "conf-xyz");
      isSuccessMock = true;
      render(<Signup />);
      expect(navigateMock).toHaveBeenCalledWith("/conference/conf-xyz", { replace: true });
      expect(sessionStorage.getItem("pendingConference")).toBeNull();
    });
  });
});
