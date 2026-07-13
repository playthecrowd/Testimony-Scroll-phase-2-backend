import { AppNotification } from "@/types";
import { seedNotifications } from "@/data/notifications";
import { loadCollection, saveCollection, newId } from "@/lib/storage";

const KEY = "notifications";

export function getUserNotifications(userId: string): AppNotification[] {
  return loadCollection<AppNotification>(KEY, seedNotifications)
    .filter((n) => n.userId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getUnreadCount(userId: string): number {
  return getUserNotifications(userId).filter((n) => !n.read).length;
}

export function markAllRead(userId: string) {
  const all = loadCollection<AppNotification>(KEY, seedNotifications);
  const updated = all.map((n) => (n.userId === userId ? { ...n, read: true } : n));
  saveCollection(KEY, updated);
}

export function markRead(id: string) {
  const all = loadCollection<AppNotification>(KEY, seedNotifications);
  const updated = all.map((n) => (n.id === id ? { ...n, read: true } : n));
  saveCollection(KEY, updated);
}

export function addNotification(input: Omit<AppNotification, "id" | "createdAt" | "read">) {
  const all = loadCollection<AppNotification>(KEY, seedNotifications);
  const notif: AppNotification = {
    ...input,
    id: newId("notif"),
    createdAt: new Date().toISOString(),
    read: false,
  };
  saveCollection(KEY, [notif, ...all]);
  return notif;
}
