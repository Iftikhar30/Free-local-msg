import { DeviceInfo, DeviceType } from "../types";

const DEVICE_ID_KEY = "locallink_device_id";
const DEVICE_NAME_KEY = "locallink_device_name";
const CUSTOM_ICE_SERVERS_KEY = "locallink_custom_ice_servers";

// Safe unambiguous character set (no 0/O or 1/I/l confusion)
const CODE_CHARACTERS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateConnectionCode(): string {
  let code = "";
  const cryptoObj = window.crypto || (window as any).msCrypto;
  if (cryptoObj && cryptoObj.getRandomValues) {
    const values = new Uint8Array(6);
    cryptoObj.getRandomValues(values);
    for (let i = 0; i < 6; i++) {
      code += CODE_CHARACTERS[values[i] % CODE_CHARACTERS.length];
    }
  } else {
    for (let i = 0; i < 6; i++) {
      code += CODE_CHARACTERS[Math.floor(Math.random() * CODE_CHARACTERS.length)];
    }
  }
  return code;
}

export function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      id = crypto.randomUUID();
    } else {
      id = "dev_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    }
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function detectDeviceEnvironment(): {
  deviceType: DeviceType;
  os: string;
  browser: string;
  defaultName: string;
} {
  const ua = navigator.userAgent;
  let os = "Unknown OS";
  let deviceType: DeviceType = "desktop";
  let browser = "Browser";

  // OS detection
  if (/iPhone/i.test(ua)) {
    os = "iOS";
    deviceType = "phone";
  } else if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) {
    os = "iPadOS";
    deviceType = "tablet";
  } else if (/Android/i.test(ua)) {
    os = "Android";
    deviceType = /Mobile/i.test(ua) ? "phone" : "tablet";
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    os = "macOS";
    deviceType = "laptop";
  } else if (/Windows NT/i.test(ua)) {
    os = "Windows";
    deviceType = "desktop";
  } else if (/Linux/i.test(ua)) {
    os = "Linux";
    deviceType = "desktop";
  }

  // Browser detection
  if (/Edg\//i.test(ua)) {
    browser = "Edge";
  } else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) {
    browser = "Chrome";
  } else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) {
    browser = "Safari";
  } else if (/Firefox\//i.test(ua)) {
    browser = "Firefox";
  }

  let defaultName = `${os} (${browser})`;
  if (deviceType === "phone") {
    defaultName = os === "iOS" ? "iPhone" : "Android Phone";
  } else if (deviceType === "laptop" || deviceType === "desktop") {
    defaultName = os === "macOS" ? "Mac" : `${os} PC`;
  }

  return { deviceType, os, browser, defaultName };
}

export function getStoredDeviceName(): string {
  const stored = localStorage.getItem(DEVICE_NAME_KEY);
  if (stored && stored.trim()) {
    return stored.trim();
  }
  const { defaultName } = detectDeviceEnvironment();
  return defaultName;
}

export function setStoredDeviceName(name: string): void {
  localStorage.setItem(DEVICE_NAME_KEY, name.trim());
}

export function getDeviceInfo(): DeviceInfo {
  const deviceId = getOrCreateDeviceId();
  const deviceName = getStoredDeviceName();
  const env = detectDeviceEnvironment();

  return {
    deviceId,
    deviceName,
    deviceType: env.deviceType,
    os: env.os,
    browser: env.browser,
    userAgent: navigator.userAgent,
  };
}

export function getCustomIceServers(): any[] {
  try {
    const raw = localStorage.getItem(CUSTOM_ICE_SERVERS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Failed to parse custom ICE servers", e);
  }
  return [];
}

export function setCustomIceServers(servers: any[]): void {
  localStorage.setItem(CUSTOM_ICE_SERVERS_KEY, JSON.stringify(servers));
}
