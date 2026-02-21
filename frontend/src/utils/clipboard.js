/**
 * Copy text to clipboard with fallback for non-HTTPS environments.
 * navigator.clipboard requires a secure context (HTTPS or localhost).
 * Falls back to document.execCommand('copy') on plain HTTP.
 *
 * @param {string} text - The text to copy
 * @returns {Promise<void>}
 */
export function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }

  // Fallback: create a temporary textarea and use execCommand
  return new Promise((resolve, reject) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
      resolve();
    } catch (err) {
      reject(err);
    } finally {
      document.body.removeChild(textarea);
    }
  });
}
