// Chage the production/local URL according to the environment
export const REDIRECT_URL_LOCAL = "http://localhost:3000";
export const REDIRECT_URL_PRODUCTION = "https://barsikchat.duckdns.org";

export const getRedirectUrl = () => {
  return import.meta.env.MODE === "production"
    ? REDIRECT_URL_PRODUCTION
    : REDIRECT_URL_LOCAL;
};

// App settings
export const APP_NAME = "BarsikChat";
export const APP_VERSION = "v1.0.0";
export const DEFAULT_BIO = `Привет! Я использую ${APP_NAME}!`;
export const DARK_THEME = "dark";
export const LIGHT_THEME = "light";
export const LOCAL_STORAGE_KEY = "theme";

// Lengths and limits for various fields
export const MAX_BIO_LENGTH = 140;
export const MAX_NAME_LENGTH = 70;
export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 20;
export const MIN_PASSWORD_LENGTH = 8;
export const MINIMUM_SEARCH_LENGTH = 2;
export const MAX_PREFETCHED_CONVERSATIONS = 10;
export const MAX_MESSAGES_PER_PAGE = 25;

// Regex patterns for validation
export const USERNAME_REGEX = /^.+$/;
export const NAME_REGEX = /^(?!.*\s{2})[a-zA-Z0-9 ]+$/;
export const EMAIL_REGEX =
  /^[^\W_]+\w*(?:[.-]\w*)*[^\W_]+@[^\W_]+(?:[.-]?\w*[^\W_]+)*(?:\.[^\W_]{2,})$/;

// Avatar settings
export const MAXIMUM_AVATAR_FILE_SIZE = "5"; // MB
export const ACCEPTED_AVATAR_FILE_TYPES = "image/jpeg,image/png,image/webp";
