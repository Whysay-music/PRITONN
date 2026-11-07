/**
 * Helper to check if user has official Telegram verification.
 * Strictly: ONLY @Admin has the verification rosette badge!
 */
export const isUserVerified = (user?: { username?: string; verified?: boolean } | null): boolean => {
  if (!user || !user.username) return false;
  return user.username.toLowerCase() === 'admin';
};
