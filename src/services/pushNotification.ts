// Web Push Notification client service
// Handles Service Worker registration, VAPID subscription, and server sync

import { PushNotificationConfig } from "../types";

const PUSH_PREF_KEY = "locallink_push_enabled";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export class PushNotificationService {
  private static swRegistration: ServiceWorkerRegistration | null = null;

  public static isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  }

  public static getPermission(): NotificationPermission {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "denied";
    }
    return Notification.permission;
  }

  public static async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!this.isSupported()) return null;

    if (this.swRegistration) return this.swRegistration;

    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      this.swRegistration = reg;
      return reg;
    } catch (err) {
      console.warn("Service worker registration error:", err);
      return null;
    }
  }

  public static async getStatus(): Promise<PushNotificationConfig> {
    const supported = this.isSupported();
    if (!supported) {
      return { supported: false, permission: "denied", isSubscribed: false };
    }

    const permission = Notification.permission;
    let isSubscribed = false;

    try {
      const reg = await this.registerServiceWorker();
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        isSubscribed = !!sub && permission === "granted";
      }
    } catch {
      isSubscribed = false;
    }

    return {
      supported,
      permission,
      isSubscribed,
    };
  }

  public static async fetchVapidPublicKey(): Promise<string | null> {
    try {
      const res = await fetch("/api/push/vapid-public-key");
      if (!res.ok) return null;
      const data = await res.json();
      return data.publicKey || null;
    } catch (err) {
      console.warn("Failed to fetch VAPID public key:", err);
      return null;
    }
  }

  public static async subscribe(
    deviceId: string,
    deviceName: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isSupported()) {
      return { success: false, error: "Web Push is not supported in this browser." };
    }

    try {
      // 1. Request notification permission
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        return {
          success: false,
          error: "Notification permission was denied. Please allow notifications in browser settings.",
        };
      }

      // 2. Register Service Worker
      const reg = await this.registerServiceWorker();
      if (!reg) {
        return { success: false, error: "Failed to initialize Service Worker." };
      }

      // 3. Fetch server VAPID key
      const vapidPublicKey = await this.fetchVapidPublicKey();
      if (!vapidPublicKey) {
        return { success: false, error: "Push notification server key unavailable." };
      }

      // 4. Subscribe to Push Manager
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      let subscription = await reg.pushManager.getSubscription();

      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      // 5. Send subscription payload to server
      const subJson = subscription.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          deviceName,
          subscription: subJson,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return { success: false, error: errData.error || "Failed to register push subscription on server." };
      }

      localStorage.setItem(PUSH_PREF_KEY, "true");
      return { success: true };
    } catch (err: any) {
      console.error("Push subscribe error:", err);
      return { success: false, error: err.message || "Push subscription failed." };
    }
  }

  public static async unsubscribe(deviceId: string): Promise<{ success: boolean }> {
    try {
      localStorage.setItem(PUSH_PREF_KEY, "false");
      const reg = await this.registerServiceWorker();
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
        }
      }

      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      }).catch(() => {});

      return { success: true };
    } catch (err) {
      console.warn("Unsubscribe error:", err);
      return { success: false };
    }
  }

  public static async sendTestNotification(deviceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Failed to send test push notification." };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Network request failed." };
    }
  }

  public static async notifyPeer(
    toDeviceId: string,
    payload: {
      type: "call" | "message" | "connect";
      fromDeviceName: string;
      text?: string;
      callId?: string;
    }
  ): Promise<boolean> {
    try {
      const res = await fetch("/api/push/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toDeviceId,
          ...payload,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
