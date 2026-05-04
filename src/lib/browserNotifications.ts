const BROWSER_NOTIFICATIONS_KEY = "clubhouse.browser-notifications";

export const getBrowserNotificationsEnabled = () => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(BROWSER_NOTIFICATIONS_KEY) !== "false";
};

export const setBrowserNotificationsEnabled = (enabled: boolean) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(BROWSER_NOTIFICATIONS_KEY, String(enabled));
};

export const ensureBrowserNotificationPermission = async () => {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return { supported: false, granted: false };
  }

  if (Notification.permission === "granted") {
    return { supported: true, granted: true };
  }

  if (Notification.permission === "denied") {
    return { supported: true, granted: false };
  }

  const permission = await Notification.requestPermission();
  return { supported: true, granted: permission === "granted" };
};

type BrowserNotificationOptions = {
  title: string;
  body: string;
  tag: string;
  onClick?: () => void;
};

export const showBrowserNotification = ({ title, body, tag, onClick }: BrowserNotificationOptions) => {
  if (typeof window === "undefined") return null;
  if (!("Notification" in window)) return null;
  if (!getBrowserNotificationsEnabled()) return null;
  if (Notification.permission !== "granted") return null;

  const notification = new Notification(title, {
    body,
    tag,
    icon: "/placeholder.svg",
  });

  notification.onclick = (event) => {
    event.preventDefault();
    window.focus();
    onClick?.();
    notification.close();
  };

  return notification;
};