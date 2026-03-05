// ==========================================
// ProfilePage.test.jsx — tests for the Profile (MyAccountView) page
// Tests: rendering all fields, avatar upload, editing fields, validation
// ==========================================
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ====== Mocks ======

// UiContext
const closeAccountViewMock = vi.fn();
vi.mock("../contexts/UiContext", () => ({
  useUi: () => ({
    closeAccountView: closeAccountViewMock,
  }),
}));

// useUser
let mockUserMetadata = {};
vi.mock("../features/authentication/useUser", () => ({
  useUser: () => ({
    user: {
      user_metadata: mockUserMetadata,
    },
  }),
}));

// useUpdateUser
let updateUserMock = vi.fn();
let isUpdatingMock = false;
vi.mock("../features/userProfile/useUpdateUser", () => ({
  useUpdateUser: () => ({
    updateUser: updateUserMock,
    isUpdating: isUpdatingMock,
  }),
}));

// useCheckUsernameAvailability
vi.mock("../features/authentication/useCheckUsernameAvailability", () => ({
  default: () => ({
    isBusy: false,
    isChecking: false,
    isTaken: false,
    checkUsername: vi.fn(() => true),
    reset: vi.fn(),
  }),
}));

// useSignout
vi.mock("../features/authentication/useSignout", () => ({
  useSignout: () => ({
    signout: vi.fn(),
    isPending: false,
  }),
}));

// config
vi.mock("../config", () => ({
  MAX_NAME_LENGTH: 70,
  MAX_LASTNAME_LENGTH: 50,
  MAX_PHONE_LENGTH: 30,
  MAX_TAG_LENGTH: 30,
  MIN_USERNAME_LENGTH: 3,
  MAX_USERNAME_LENGTH: 20,
  MAX_BIO_LENGTH: 140,
  NAME_REGEX: /^(?!.*\s{2})[a-zA-Z0-9а-яА-ЯёЁ ]+$/,
  USERNAME_REGEX: /^.+$/,
  PHONE_REGEX: /^[\d\s\-\+\(\)]*$/,
  TAG_REGEX: /^[a-zA-Z0-9_@]*$/,
  ACCEPTED_AVATAR_FILE_TYPES: "image/jpeg,image/png,image/webp",
}));

// avatarUtils
vi.mock("../utils/avatarUtils", () => ({
  getRandomAvatar: (name) => `https://dicebear.test/avatar/${name}`,
}));

// react-hot-toast
vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
    loading: vi.fn(),
  },
}));

import MyAccountView from "../features/userProfile/MyAccountView";

describe("ProfilePage (MyAccountView)", () => {
  beforeEach(() => {
    closeAccountViewMock.mockClear();
    updateUserMock = vi.fn();
    isUpdatingMock = false;
    mockUserMetadata = {
      fullname: "Иван",
      firstName: "Иван",
      lastName: "Петров",
      username: "ivanp",
      bio: "Привет!",
      avatar_url: "/api/uploads/avatar_test.jpg",
      tag: "@ivanp",
      phone: "+7 999 123-45-67",
    };
  });

  // ------------------------------------------
  // RENDERING
  // ------------------------------------------
  describe("Rendering", () => {
    it("renders profile header", () => {
      render(<MyAccountView />);
      expect(screen.getByText("Профиль")).toBeInTheDocument();
    });

    it("renders avatar image", () => {
      render(<MyAccountView />);
      const avatar = screen.getByAltText("avatar");
      expect(avatar).toBeInTheDocument();
      expect(avatar.src).toContain("avatar_test.jpg");
    });

    it("renders avatar upload button", () => {
      render(<MyAccountView />);
      expect(screen.getByLabelText("upload photo")).toBeInTheDocument();
    });

    it("renders Имя (first name) field", () => {
      render(<MyAccountView />);
      expect(screen.getByText("Имя")).toBeInTheDocument();
      expect(screen.getByText("Иван")).toBeInTheDocument();
    });

    it("renders Фамилия (last name) field", () => {
      render(<MyAccountView />);
      expect(screen.getByText("Фамилия")).toBeInTheDocument();
      expect(screen.getByText("Петров")).toBeInTheDocument();
    });

    it("renders Тег field", () => {
      render(<MyAccountView />);
      expect(screen.getByText("Тег")).toBeInTheDocument();
      expect(screen.getByText("@ivanp")).toBeInTheDocument();
    });

    it("renders Телефон field", () => {
      render(<MyAccountView />);
      expect(screen.getByText("Телефон")).toBeInTheDocument();
      expect(screen.getByText("+7 999 123-45-67")).toBeInTheDocument();
    });

    it("renders Логин field", () => {
      render(<MyAccountView />);
      expect(screen.getByText("Логин")).toBeInTheDocument();
    });

    it("renders О себе (bio) field", () => {
      render(<MyAccountView />);
      expect(screen.getByText("О себе")).toBeInTheDocument();
      expect(screen.getByText("Привет!")).toBeInTheDocument();
    });

    it("renders sign out button", () => {
      render(<MyAccountView />);
      expect(screen.getByText("Выйти из аккаунта")).toBeInTheDocument();
    });
  });

  // ------------------------------------------
  // EDIT FIELDS
  // ------------------------------------------
  describe("Field editing", () => {
    it("shows edit buttons for each field", () => {
      render(<MyAccountView />);
      const editButtons = screen.getAllByLabelText("Edit");
      // Имя, Фамилия, Тег, Телефон, Логин, О себе = 6 fields
      expect(editButtons.length).toBeGreaterThanOrEqual(6);
    });

    it("clicking edit button on Имя enters edit mode with input", async () => {
      const user = userEvent.setup();
      render(<MyAccountView />);

      const editButtons = screen.getAllByLabelText("Edit");
      await user.click(editButtons[0]); // first edit button = Имя

      const input = screen.getByDisplayValue("Иван");
      expect(input).toBeInTheDocument();
      expect(input.tagName).toBe("INPUT");
    });

    it("clicking edit button on Фамилия enters edit mode", async () => {
      const user = userEvent.setup();
      render(<MyAccountView />);

      const editButtons = screen.getAllByLabelText("Edit");
      await user.click(editButtons[1]); // second edit button = Фамилия

      const input = screen.getByDisplayValue("Петров");
      expect(input).toBeInTheDocument();
    });

    it("clicking edit button on Тег enters edit mode", async () => {
      const user = userEvent.setup();
      render(<MyAccountView />);

      const editButtons = screen.getAllByLabelText("Edit");
      await user.click(editButtons[2]); // third = Тег

      const input = screen.getByDisplayValue("@ivanp");
      expect(input).toBeInTheDocument();
    });

    it("clicking edit button on Телефон enters edit mode", async () => {
      const user = userEvent.setup();
      render(<MyAccountView />);

      const editButtons = screen.getAllByLabelText("Edit");
      await user.click(editButtons[3]); // fourth = Телефон

      const input = screen.getByDisplayValue("+7 999 123-45-67");
      expect(input).toBeInTheDocument();
    });
  });

  // ------------------------------------------
  // BACK BUTTON
  // ------------------------------------------
  describe("Navigation", () => {
    it("calls closeAccountView when back button is clicked", async () => {
      const user = userEvent.setup();
      render(<MyAccountView />);

      const backButtons = screen.getAllByRole("button");
      // The first button should be the back button (IconButton)
      await user.click(backButtons[0]);

      expect(closeAccountViewMock).toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // AVATAR UPLOAD
  // ------------------------------------------
  describe("Avatar upload", () => {
    it("renders file input for avatar upload", () => {
      render(<MyAccountView />);
      const fileInput = document.getElementById("uploadPhoto");
      expect(fileInput).toBeInTheDocument();
      expect(fileInput.type).toBe("file");
      expect(fileInput.accept).toContain("image/jpeg");
    });

    it("calls updateUser when a file is selected", async () => {
      render(<MyAccountView />);
      const fileInput = document.getElementById("uploadPhoto");

      const file = new File(["fake-image"], "photo.jpg", { type: "image/jpeg" });
      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(updateUserMock).toHaveBeenCalledTimes(1);
      const callArgs = updateUserMock.mock.calls[0][0];
      expect(callArgs.avatar).toEqual(file);
    });
  });

  // ------------------------------------------
  // EMPTY STATE
  // ------------------------------------------
  describe("Empty profile fields", () => {
    it("renders with empty fields when user has no profile data", () => {
      mockUserMetadata = {
        fullname: "",
        firstName: "",
        lastName: "",
        username: "newuser",
        bio: "",
        avatar_url: "",
        tag: "",
        phone: "",
      };

      render(<MyAccountView />);

      expect(screen.getByText("Имя")).toBeInTheDocument();
      expect(screen.getByText("Фамилия")).toBeInTheDocument();
      expect(screen.getByText("Тег")).toBeInTheDocument();
      expect(screen.getByText("Телефон")).toBeInTheDocument();
      expect(screen.getByText("Логин")).toBeInTheDocument();
      expect(screen.getByText("О себе")).toBeInTheDocument();
    });

    it("shows fallback avatar when no avatar_url", () => {
      mockUserMetadata = {
        ...mockUserMetadata,
        avatar_url: "",
      };

      render(<MyAccountView />);
      const avatar = screen.getByAltText("avatar");
      expect(avatar.src).toContain("dicebear");
    });
  });
});
