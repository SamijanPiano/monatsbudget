// Dünner Wrapper um die Web Notifications API. Lokal, kein Server: echte
// zeitgesteuerte Push-Termine sind ohne Backend nicht möglich, daher wertet die
// App den „Vertragswecker" beim Start aus (siehe contracts.dueReminders) und
// zeigt dann optional eine Notification. Alle Aufrufe sind no-ops, wenn die
// API fehlt oder die Erlaubnis nicht erteilt wurde.

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission(): NotificationPermission {
  return notificationsSupported() ? Notification.permission : 'denied'
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied'
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

/** Zeigt eine lokale Notification, sofern erlaubt. Best-effort, wirft nie. */
export function notify(title: string, body: string): void {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body })
  } catch {
    // Best-effort; manche Browser blocken außerhalb einer User-Geste.
  }
}
