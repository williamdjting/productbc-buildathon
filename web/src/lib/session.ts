import type { SessionData } from "./types";

const KEY = "aeo_session";

/**
 * Saves the full session to sessionStorage.
 * Data is lost if the user closes the tab — that is intentional for v1.
 */
export function saveSession(data: SessionData): void {
  sessionStorage.setItem(KEY, JSON.stringify(data));
}

/**
 * Reads the session from sessionStorage.
 * Returns null if nothing is stored or if the data is corrupted.
 */
export function loadSession(): SessionData | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

/**
 * Merges a partial update into the existing session.
 * Used to add optimizedText after /api/improve completes.
 */
export function updateSession(patch: Partial<SessionData>): void {
  const existing = loadSession();
  if (!existing) return;
  saveSession({ ...existing, ...patch });
}

/**
 * Clears the session. Called on "Start over".
 */
export function clearSession(): void {
  sessionStorage.removeItem(KEY);
}
