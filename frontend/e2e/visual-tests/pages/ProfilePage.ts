/**
 * BarsikChat — Page Object: Profile Page
 *
 * Covers: MyProfilePage, UserProfilePage, EditProfilePage
 */
import { type Page, type Locator, expect } from '@playwright/test';

export class ProfilePage {
  readonly page: Page;

  /* ── My Profile ── */
  readonly myProfilePage: Locator;
  readonly myProfileHeader: Locator;
  readonly myProfileAvatar: Locator;
  readonly myProfileAvatarImage: Locator;
  readonly myProfileAvatarLetter: Locator;
  readonly myProfileDisplayName: Locator;
  readonly myProfileStatus: Locator;
  readonly myProfileActions: Locator;
  readonly myProfileActionBtns: Locator;
  readonly myProfilePhotoBtn: Locator;
  readonly myProfileEditBtn: Locator;
  readonly myProfileSettingsBtn: Locator;
  readonly myProfileInfoRows: Locator;
  readonly myProfileLogout: Locator;
  readonly myProfileDotsBtn: Locator;
  readonly myProfileDropdown: Locator;

  /* ── Edit Profile ── */
  readonly editProfilePage: Locator;
  readonly editProfileBack: Locator;
  readonly editProfileSave: Locator;
  readonly editProfilePhone: Locator;
  readonly editProfileBirthday: Locator;
  readonly editProfileFirstName: Locator;
  readonly editProfileLastName: Locator;
  readonly editProfileBio: Locator;
  readonly editProfileCharCount: Locator;

  /* ── User Profile (viewing another user) ── */
  readonly userProfilePage: Locator;
  readonly userProfileBack: Locator;
  readonly userProfileAvatar: Locator;
  readonly userProfileName: Locator;
  readonly userProfileStatus: Locator;
  readonly userProfileActions: Locator;
  readonly userProfileChatBtn: Locator;
  readonly userProfileCallBtn: Locator;

  /* ── Profile Modal (avatar upload) ── */
  readonly profileModal: Locator;
  readonly profileModalOverlay: Locator;
  readonly profileModalUploadBtn: Locator;
  readonly profileModalDeleteBtn: Locator;

  /* ── Name Edit Modal ── */
  readonly nameModal: Locator;
  readonly nameModalFirstName: Locator;
  readonly nameModalLastName: Locator;
  readonly nameModalSave: Locator;
  readonly nameModalCancel: Locator;

  constructor(page: Page) {
    this.page = page;

    // My Profile
    this.myProfilePage = page.locator('.my-profile-page');
    this.myProfileLogout = page.locator('.my-profile-logout');
    this.myProfileHeader = page.locator('.my-profile-header');
    this.myProfileAvatar = page.locator('.my-profile-avatar');
    this.myProfileAvatarImage = page.locator('.my-profile-avatar img');
    this.myProfileAvatarLetter = page.locator('.my-profile-avatar-letter');
    this.myProfileDisplayName = page.locator('.my-profile-display-name');
    this.myProfileStatus = page.locator('.my-profile-online-status');
    this.myProfileActions = page.locator('.my-profile-actions');
    this.myProfileActionBtns = page.locator('.my-profile-action-btn');
    this.myProfilePhotoBtn = page.locator('.my-profile-action-btn').filter({ hasText: 'фото' });
    this.myProfileEditBtn = page.locator('.my-profile-action-btn').filter({ hasText: 'Изменить' });
    this.myProfileSettingsBtn = page.locator('.my-profile-action-btn').filter({ hasText: 'Настройка' });
    this.myProfileInfoRows = page.locator('.my-profile-info-row');
    this.myProfileDotsBtn = page.locator('.my-profile-dots-btn');
    this.myProfileDropdown = page.locator('.my-profile-dropdown');

    // Edit Profile
    this.editProfilePage = page.locator('.edit-profile-page');
    this.editProfileBack = page.locator('.edit-profile-back');
    this.editProfileSave = page.locator('.edit-profile-save-btn');
    this.editProfilePhone = page.locator('.edit-profile-phone');
    this.editProfileBirthday = page.locator('.edit-profile-birthday');
    this.editProfileFirstName = page.locator('.edit-profile-field input[placeholder="Имя"]');
    this.editProfileLastName = page.locator('.edit-profile-field input[placeholder="Фамилия"]');
    this.editProfileBio = page.locator('.edit-profile-bio');
    this.editProfileCharCount = page.locator('.edit-profile-char-count');

    // User Profile
    this.userProfilePage = page.locator('.user-profile-page');
    this.userProfileBack = page.locator('.user-profile-back');
    this.userProfileAvatar = page.locator('.user-profile-avatar');
    this.userProfileName = page.locator('.user-profile-display-name');
    this.userProfileStatus = page.locator('.user-profile-online-status');
    this.userProfileActions = page.locator('.user-profile-actions');
    this.userProfileChatBtn = page.locator('.user-profile-action-btn').filter({ hasText: 'Чат' });
    this.userProfileCallBtn = page.locator('.user-profile-action-btn').filter({ hasText: 'Звонок' });

    // Profile Modal
    this.profileModal = page.locator('.profile-modal');
    this.profileModalOverlay = page.locator('.profile-modal-overlay');
    this.profileModalUploadBtn = page.locator('.profile-modal-upload-btn');
    this.profileModalDeleteBtn = page.locator('.profile-modal-delete-btn');

    // Name Modal
    this.nameModal = page.locator('.my-profile-modal');
    this.nameModalFirstName = page.locator('.my-profile-modal input[placeholder="Имя"]');
    this.nameModalLastName = page.locator('.my-profile-modal input[placeholder="Фамилия"]');
    this.nameModalSave = page.locator('.my-profile-modal-save');
    this.nameModalCancel = page.locator('.my-profile-modal-cancel');
  }

  /** Navigate to My Profile via mobile bottom nav */
  async gotoMyProfile() {
    const bottomNavItems = this.page.locator('.bottom-nav-item');
    await bottomNavItems.filter({ hasText: 'Профиль' }).click();
    await expect(this.myProfilePage).toBeVisible({ timeout: 5_000 });
  }

  /** Navigate to Edit Profile from My Profile */
  async gotoEditProfile() {
    await this.myProfileEditBtn.click();
    await expect(this.editProfilePage).toBeVisible({ timeout: 5_000 });
  }

  /** Open profile dots menu */
  async openProfileMenu() {
    await this.myProfileDotsBtn.click();
    await expect(this.myProfileDropdown).toBeVisible();
  }

  /** Click avatar to open profile modal */
  async openAvatarModal() {
    await this.myProfileAvatar.click();
    await expect(this.profileModal).toBeVisible();
  }

  /** Open name edit modal */
  async openNameModal() {
    await this.openProfileMenu();
    const changeName = this.myProfileDropdown.locator('button').filter({ hasText: 'Изменить имя' });
    await changeName.click();
    await expect(this.nameModal).toBeVisible();
  }

  /** Go back from edit profile */
  async editProfileGoBack() {
    await this.editProfileBack.click();
    await this.page.waitForTimeout(300);
  }

  /** Check viewport is mobile (<= 768px) */
  isMobile(): boolean {
    return (this.page.viewportSize()?.width ?? 1920) <= 768;
  }

  /** Get My Profile interactive elements for clickability testing */
  getMyProfileInteractiveElements(): Locator[] {
    return [
      this.myProfilePhotoBtn,
      this.myProfileEditBtn,
      this.myProfileSettingsBtn,
      this.myProfileLogout,
      this.myProfileDotsBtn,
    ];
  }

  /** Get Edit Profile interactive elements */
  getEditProfileInteractiveElements(): Locator[] {
    return [
      this.editProfileBack,
      this.editProfileSave,
      this.editProfileFirstName,
      this.editProfileLastName,
      this.editProfileBio,
    ];
  }

  /** Dynamic elements to mask in screenshots */
  getDynamicMasks(): Locator[] {
    return [
      this.myProfileAvatarImage,
      this.myProfileDisplayName,
      this.myProfileStatus,
      this.page.locator('img'),
    ];
  }
}
