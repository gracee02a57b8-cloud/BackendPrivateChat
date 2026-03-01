// ==========================================
// Signin.test.jsx — tests for login page with remember-me and auto-login
// ==========================================
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ====== Mocks ======

// react-router-dom
const navigateMock = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
  Link: ({ children, to }) => <a href={to}>{children}</a>,
}));

// useSignin
let signinMock = vi.fn();
let isPendingMock = false;
vi.mock("../features/authentication/useSignin", () => ({
  useSignin: () => ({
    signin: signinMock,
    isPending: isPendingMock,
  }),
}));

// useUser
let isAuthenticatedMock = false;
vi.mock("../features/authentication/useUser", () => ({
  useUser: () => ({
    isAuthenticated: isAuthenticatedMock,
  }),
}));

// config
vi.mock("../config", () => ({
  APP_NAME: "BarsikChat",
}));

import Signin from "../features/authentication/Signin";

describe("Signin", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    signinMock = vi.fn();
    isPendingMock = false;
    isAuthenticatedMock = false;
    localStorage.clear();
  });

  // ------------------------------------------
  // RENDERING
  // ------------------------------------------
  describe("Rendering", () => {
    it("renders login heading", () => {
      render(<Signin />);
      expect(screen.getByText("Вход в аккаунт")).toBeInTheDocument();
    });

    it("renders username input", () => {
      render(<Signin />);
      expect(screen.getByLabelText("Имя пользователя")).toBeInTheDocument();
    });

    it("renders password input", () => {
      render(<Signin />);
      expect(screen.getByLabelText("Пароль")).toBeInTheDocument();
    });

    it("renders 'Запомнить меня' checkbox", () => {
      render(<Signin />);
      expect(screen.getByLabelText("Запомнить меня")).toBeInTheDocument();
    });

    it("renders submit button with 'Войти' text", () => {
      render(<Signin />);
      expect(screen.getByRole("button", { name: /войти/i })).toBeInTheDocument();
    });

    it("renders link to signup page", () => {
      render(<Signin />);
      expect(screen.getByText("Зарегистрироваться")).toBeInTheDocument();
    });

    it("sets document title", () => {
      render(<Signin />);
      expect(document.title).toBe("BarsikChat — Вход");
    });
  });

  // ------------------------------------------
  // FORM VALIDATION
  // ------------------------------------------
  describe("Form validation", () => {
    it("shows error when username is empty on submit", async () => {
      render(<Signin />);
      fireEvent.click(screen.getByRole("button", { name: /войти/i }));

      await waitFor(() => {
        expect(screen.getByText("Введите имя пользователя.")).toBeInTheDocument();
      });
      expect(signinMock).not.toHaveBeenCalled();
    });

    it("shows error when password is empty on submit", async () => {
      const user = userEvent.setup();
      render(<Signin />);

      await user.type(screen.getByLabelText("Имя пользователя"), "alice");
      fireEvent.click(screen.getByRole("button", { name: /войти/i }));

      await waitFor(() => {
        expect(screen.getByText("Введите пароль.")).toBeInTheDocument();
      });
      expect(signinMock).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // SUCCESSFUL LOGIN
  // ------------------------------------------
  describe("Successful login", () => {
    it("calls signin with username and password", async () => {
      const user = userEvent.setup();
      render(<Signin />);

      await user.type(screen.getByLabelText("Имя пользователя"), "alice");
      await user.type(screen.getByLabelText("Пароль"), "secret123");
      fireEvent.click(screen.getByRole("button", { name: /войти/i }));

      await waitFor(() => {
        expect(signinMock).toHaveBeenCalledTimes(1);
      });
      const [args] = signinMock.mock.calls[0];
      expect(args.username).toBe("alice");
      expect(args.password).toBe("secret123");
      expect(args.rememberMe).toBe(false);
    });

    it("calls signin with rememberMe=true when checkbox is checked", async () => {
      const user = userEvent.setup();
      render(<Signin />);

      await user.type(screen.getByLabelText("Имя пользователя"), "alice");
      await user.type(screen.getByLabelText("Пароль"), "secret123");
      await user.click(screen.getByLabelText("Запомнить меня"));
      fireEvent.click(screen.getByRole("button", { name: /войти/i }));

      await waitFor(() => {
        expect(signinMock).toHaveBeenCalledTimes(1);
      });
      const [args] = signinMock.mock.calls[0];
      expect(args.rememberMe).toBe(true);
    });

    it("navigates to /chat on success", async () => {
      signinMock = vi.fn((args, opts) => opts?.onSuccess?.());
      const user = userEvent.setup();
      render(<Signin />);

      await user.type(screen.getByLabelText("Имя пользователя"), "alice");
      await user.type(screen.getByLabelText("Пароль"), "secret123");
      fireEvent.click(screen.getByRole("button", { name: /войти/i }));

      await waitFor(() => {
        expect(navigateMock).toHaveBeenCalledWith("/chat", { replace: true });
      });
    });

    it("navigates to pending conference on success if present", async () => {
      sessionStorage.setItem("pendingConference", "conf-abc");
      signinMock = vi.fn((args, opts) => opts?.onSuccess?.());
      const user = userEvent.setup();
      render(<Signin />);

      await user.type(screen.getByLabelText("Имя пользователя"), "alice");
      await user.type(screen.getByLabelText("Пароль"), "secret123");
      fireEvent.click(screen.getByRole("button", { name: /войти/i }));

      await waitFor(() => {
        expect(navigateMock).toHaveBeenCalledWith("/conference/conf-abc", { replace: true });
      });
      expect(sessionStorage.getItem("pendingConference")).toBeNull();
    });
  });

  // ------------------------------------------
  // REMEMBER ME / AUTO-LOGIN
  // ------------------------------------------
  describe("Remember me and auto-login", () => {
    it("auto-logins when saved credentials exist", () => {
      localStorage.setItem("rememberMe", "true");
      localStorage.setItem("savedUsername", "alice");
      localStorage.setItem("savedPassword", btoa("secret123"));

      render(<Signin />);

      expect(signinMock).toHaveBeenCalledTimes(1);
      const [args] = signinMock.mock.calls[0];
      expect(args.username).toBe("alice");
      expect(args.password).toBe("secret123");
      expect(args.rememberMe).toBe(true);
    });

    it("does not auto-login when rememberMe is not set", () => {
      render(<Signin />);
      expect(signinMock).not.toHaveBeenCalled();
    });

    it("does not auto-login when savedUsername is missing", () => {
      localStorage.setItem("rememberMe", "true");
      localStorage.setItem("savedPassword", btoa("secret123"));

      render(<Signin />);
      expect(signinMock).not.toHaveBeenCalled();
    });

    it("does not auto-login when savedPassword is missing", () => {
      localStorage.setItem("rememberMe", "true");
      localStorage.setItem("savedUsername", "alice");

      render(<Signin />);
      expect(signinMock).not.toHaveBeenCalled();
    });

    it("clears corrupted saved credentials gracefully", () => {
      localStorage.setItem("rememberMe", "true");
      localStorage.setItem("savedUsername", "alice");
      localStorage.setItem("savedPassword", "!!!invalid-base64");

      // atob will throw on invalid base64 — component should handle it
      // Mock atob to throw
      const origAtob = globalThis.atob;
      globalThis.atob = () => { throw new Error("Invalid base64"); };

      render(<Signin />);

      // Should not crash, should clear corrupted data
      expect(localStorage.getItem("rememberMe")).toBeNull();
      expect(localStorage.getItem("savedUsername")).toBeNull();
      expect(localStorage.getItem("savedPassword")).toBeNull();

      globalThis.atob = origAtob;
    });

    it("auto-login navigates to /chat on success", async () => {
      localStorage.setItem("rememberMe", "true");
      localStorage.setItem("savedUsername", "alice");
      localStorage.setItem("savedPassword", btoa("secret123"));

      signinMock = vi.fn((args, opts) => opts?.onSuccess?.());

      render(<Signin />);

      await waitFor(() => {
        expect(navigateMock).toHaveBeenCalledWith("/chat", { replace: true });
      });
    });
  });

  // ------------------------------------------
  // LOADING STATE
  // ------------------------------------------
  describe("Loading state", () => {
    it("shows loading spinner when isPending", () => {
      isPendingMock = true;
      render(<Signin />);
      expect(screen.getByText("Вход...")).toBeInTheDocument();
    });

    it("disables inputs when isPending", () => {
      isPendingMock = true;
      render(<Signin />);
      expect(screen.getByLabelText("Имя пользователя")).toBeDisabled();
      expect(screen.getByLabelText("Пароль")).toBeDisabled();
      expect(screen.getByLabelText("Запомнить меня")).toBeDisabled();
    });
  });

  // ------------------------------------------
  // REDIRECT IF AUTHENTICATED
  // ------------------------------------------
  describe("Redirect when authenticated", () => {
    it("navigates to /chat if already authenticated", () => {
      isAuthenticatedMock = true;
      render(<Signin />);
      expect(navigateMock).toHaveBeenCalledWith("/chat", { replace: true });
    });
  });
});
