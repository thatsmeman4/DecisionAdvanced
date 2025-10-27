/**
 * Password caching utilities for room authentication
 * Stores password hashes in sessionStorage to avoid re-authentication within same session
 */

export interface CachedPasswordData {
  hash: string;
  timestamp: number;
  roomCode: string;
}

const CACHE_PREFIX = "room_auth_";
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Cache password hash for a room
 */
export const cachePasswordHash = (
  roomCode: string,
  passwordHash: string
): void => {
  try {
    const cacheData: CachedPasswordData = {
      hash: passwordHash,
      timestamp: Date.now(),
      roomCode,
    };
    sessionStorage.setItem(
      `${CACHE_PREFIX}${roomCode}`,
      JSON.stringify(cacheData)
    );
  } catch (error) {
    console.warn("Failed to cache password hash:", error);
  }
};

/**
 * Get cached password hash for a room
 */
export const getCachedPasswordHash = (roomCode: string): string | null => {
  try {
    const cached = sessionStorage.getItem(`${CACHE_PREFIX}${roomCode}`);
    if (!cached) return null;

    const cacheData: CachedPasswordData = JSON.parse(cached);

    // Check if cache is expired
    if (Date.now() - cacheData.timestamp > CACHE_EXPIRY) {
      clearPasswordCache(roomCode);
      return null;
    }

    return cacheData.hash;
  } catch (error) {
    console.warn("Failed to get cached password hash:", error);
    return null;
  }
};

/**
 * Clear password cache for a room
 */
export const clearPasswordCache = (roomCode: string): void => {
  try {
    sessionStorage.removeItem(`${CACHE_PREFIX}${roomCode}`);
  } catch (error) {
    console.warn("Failed to clear password cache:", error);
  }
};

/**
 * Clear all password caches
 */
export const clearAllPasswordCaches = (): void => {
  try {
    const keys = Object.keys(sessionStorage);
    keys.forEach((key) => {
      if (key.startsWith(CACHE_PREFIX)) {
        sessionStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn("Failed to clear all password caches:", error);
  }
};
