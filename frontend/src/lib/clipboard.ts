/** Puts plain text on the Windows clipboard (WebView2 clipboard API, no Rust needed). */
export function copyText(text: string): Promise<void> {
  if (!navigator.clipboard) return Promise.reject(new Error("clipboard unavailable"));
  return navigator.clipboard.writeText(text);
}
