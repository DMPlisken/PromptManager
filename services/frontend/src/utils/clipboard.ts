/**
 * Copy text to clipboard with fallback for non-HTTPS contexts (e.g., Proxmox HTTP).
 * navigator.clipboard.writeText() requires a secure context (HTTPS or localhost).
 * Falls back to document.execCommand('copy') for HTTP deployments.
 */
export async function copyToClipboard(text: string): Promise<void> {
  // Try modern API first
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  // Fallback for non-secure contexts (HTTP)
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    const success = document.execCommand("copy");
    if (!success) throw new Error("execCommand copy failed");
  } finally {
    document.body.removeChild(textarea);
  }
}
