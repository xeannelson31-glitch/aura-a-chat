/**
 * Convert a raw error (and optional HTTP status) into a short, user-friendly
 * explanation suitable for a toast or inline message.
 *
 * Extracted from useChat so it can be unit-tested in isolation.
 */
export function friendlyError(e: unknown, status?: number): string {
  if (e instanceof Error && e.name === "AbortError") return "Request stopped.";
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "You're offline. Check your connection and try again.";
  }
  if (status === 401 || status === 403)
    return "You're not authorized to use this model.";
  if (status === 404) return "The chat service couldn't be reached.";
  if (status === 408 || status === 504)
    return "The model took too long to respond. Please retry.";
  if (status === 413) return "Message or attachment is too large.";
  if (status === 429)
    return "You're sending requests too fast. Please wait a moment.";
  if (status === 402)
    return "AI credits are exhausted. Please add credits and try again.";
  if (status && status >= 500)
    return "The model service is temporarily unavailable. Please retry.";
  if (e instanceof TypeError) return "Network error. Check your connection and try again.";
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong. Please try again.";
}
