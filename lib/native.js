'use client';
// Native device capabilities (iOS via Capacitor). Every function is fully
// guarded: on the web, or on an older native build without a given plugin,
// the call silently no-ops instead of throwing. Safe to call from anywhere.
import { Capacitor } from '@capacitor/core';

export function isNative() {
  try {
    return typeof Capacitor?.isNativePlatform === 'function' && Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

// ── Haptic feedback ─────────────────────────────────────────────
export async function haptic(kind = 'light') {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
    if (kind === 'success') return await Haptics.notification({ type: NotificationType.Success });
    if (kind === 'warning') return await Haptics.notification({ type: NotificationType.Warning });
    if (kind === 'error') return await Haptics.notification({ type: NotificationType.Error });
    const style = kind === 'heavy' ? ImpactStyle.Heavy : kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light;
    await Haptics.impact({ style });
  } catch { /* plugin unavailable — ignore */ }
}

// ── Native share sheet ──────────────────────────────────────────
// Returns true if the native share sheet was shown, false otherwise
// (so callers can fall back to their existing web share/link behaviour).
export async function nativeShare({ title, text, url }) {
  if (!isNative()) return false;
  try {
    const { Share } = await import('@capacitor/share');
    await Share.share({ title, text, url, dialogTitle: title || 'Share' });
    return true;
  } catch {
    return false;
  }
}

// ── On-device game reminders (local notifications) ──────────────
function notifIdFor(gameId) {
  // LocalNotifications ids must be 32-bit ints; hash the game id deterministically.
  let h = 0;
  const s = String(gameId);
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2000000000 || 1;
}

function reminderDateFor(game) {
  try {
    const [y, m, d] = String(game.date).split('-').map(Number);
    const [hh, mm] = String(game.time || '00:00').split(':').map(Number);
    if (!y || !m || !d) return null;
    const start = new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
    const hoursBefore = Number(game.reminderHours) > 0 ? Number(game.reminderHours) : 2;
    return new Date(start.getTime() - hoursBefore * 3600 * 1000);
  } catch {
    return null;
  }
}

export async function ensureNotificationPermission() {
  if (!isNative()) return false;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions();
    return perm.display === 'granted';
  } catch {
    return false;
  }
}

// Schedule an on-device reminder ahead of a game the user joined.
// No-ops on web, without permission, or if the reminder time is already past.
export async function scheduleGameReminder(game) {
  if (!isNative() || !game?.id) return false;
  try {
    const when = reminderDateFor(game);
    if (!when || when.getTime() <= Date.now()) return false;
    const granted = await ensureNotificationPermission();
    if (!granted) return false;
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.schedule({
      notifications: [{
        id: notifIdFor(game.id),
        title: game.title ? `⚡ ${game.title}` : 'Upcoming game',
        body: `Kickoff at ${game.time || 'soon'}${game.location ? ` · ${game.location}` : ''}. Tap to view details.`,
        schedule: { at: when },
        extra: { gameId: game.id },
      }],
    });
    return true;
  } catch {
    return false;
  }
}

export async function cancelGameReminder(gameId) {
  if (!isNative() || !gameId) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: [{ id: notifIdFor(gameId) }] });
  } catch { /* ignore */ }
}
