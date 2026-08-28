import { ConnectedPeer, DeviceInfo, DeviceType } from "../types";

const DEVICE_ID_KEY = "locallink_device_id";
const DEVICE_NAME_KEY = "locallink_device_name";
const CONNECTION_CODE_KEY = "locallink_connection_code";
const KNOWN_PEERS_KEY = "locallink_known_peers_v1";
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

/**
 * Retrieves the persistent connection code from browser localStorage,
 * or generates and persists a new one if this is the very first visit.
 * Browser reloads will preserve the same code.
 */
export function getOrCreateConnectionCode(): string {
  if (typeof window === "undefined") return generateConnectionCode();
  let code = localStorage.getItem(CONNECTION_CODE_KEY);
  if (!code || code.trim().length !== 6) {
    code = generateConnectionCode();
    localStorage.setItem(CONNECTION_CODE_KEY, code);
  }
  return code.trim().toUpperCase();
}

/**
 * Explicitly regenerates and saves a new connection code when the user clicks "Generate New Code".
 */
export function rotateConnectionCode(): string {
  const newCode = generateConnectionCode();
  if (typeof window !== "undefined") {
    localStorage.setItem(CONNECTION_CODE_KEY, newCode);
  }
  return newCode;
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

/**
 * Persist known peers across reloads
 */
export function getStoredKnownPeers(): ConnectedPeer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KNOWN_PEERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((p) => ({
          ...p,
          status: "disconnected" as const,
          dataChannelStatus: "closed" as const,
        }));
      }
    }
  } catch (e) {
    console.warn("Failed to load known peers from storage:", e);
  }
  return [];
}

export function saveStoredKnownPeers(peers: ConnectedPeer[]): void {
  if (typeof window === "undefined") return;
  try {
    const serialized = peers.map((p) => ({
      deviceId: p.deviceId,
      deviceName: p.deviceName,
      deviceType: p.deviceType,
      os: p.os,
      connectionCode: p.connectionCode,
      connectedAt: p.connectedAt,
      lastSeen: p.lastSeen,
      isInitiator: p.isInitiator,
      unreadCount: 0,
      iceCandidateType: p.iceCandidateType,
    }));
    localStorage.setItem(KNOWN_PEERS_KEY, JSON.stringify(serialized.slice(-30)));
  } catch (e) {
    console.warn("Failed to save known peers:", e);
  }
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

export function clearAllStorage(): void {
  try {
    localStorage.removeItem(DEVICE_ID_KEY);
    localStorage.removeItem(DEVICE_NAME_KEY);
    localStorage.removeItem(CONNECTION_CODE_KEY);
    localStorage.removeItem(KNOWN_PEERS_KEY);
    localStorage.removeItem(CUSTOM_ICE_SERVERS_KEY);
    localStorage.removeItem("locallink_sound_enabled");
    // Clear chat history keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("locallink_")) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    console.warn("Failed to clear local storage:", e);
  }
}
