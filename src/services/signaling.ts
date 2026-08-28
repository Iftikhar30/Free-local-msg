import { SignalMessage } from "../types";

export class SignalingClient {
  private deviceId: string;
  private deviceName: string;
  private baseUrl: string;
  private pollIntervalId: any = null;
  private heartbeatIntervalId: any = null;
  private onSignalReceivedCallback?: (signal: SignalMessage) => void;
  private onErrorCallback?: (err: Error) => void;
  private isPolling = false;

  constructor(deviceId: string, deviceName: string) {
    this.deviceId = deviceId;
    this.deviceName = deviceName;
    // Determine base URL: uses VITE_SIGNALING_URL if present, otherwise defaults automatically to the current deployment
    const customUrl = (import.meta as any).env?.VITE_SIGNALING_URL;
    if (customUrl && typeof customUrl === "string" && customUrl.trim() !== "") {
      let cleaned = customUrl.trim().replace(/\/$/, "");
      if (cleaned.endsWith("/api/signal")) {
        cleaned = cleaned.substring(0, cleaned.length - "/api/signal".length);
      }
      this.baseUrl = cleaned;
    } else {
      // Default to current origin / deployment
      this.baseUrl = "";
    }
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public async fetchIceServers(): Promise<RTCIceServer[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/signal/ice-servers`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
          return data.iceServers;
        }
      }
    } catch {
      // Non-blocking fallback to local STUN configuration
    }
    return [];
  }

  public updateDeviceName(name: string) {
    this.deviceName = name;
  }

  public async register(code: string): Promise<{ success: boolean; codeTaken?: boolean; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/signal/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: this.deviceId,
          code,
          deviceName: this.deviceName,
          userAgent: navigator.userAgent,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, codeTaken: data.codeTaken, error: data.error || "Failed to register code" };
      }
      return { success: true };
    } catch (err: any) {
      console.error("Signaling register error:", err);
      return { success: false, error: err.message || "Network error connecting to signaling server" };
    }
  }

  public async sendHeartbeat(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/signal/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: this.deviceId }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async lookupCode(code: string): Promise<{
    success: boolean;
    target?: { deviceId: string; deviceName: string; code: string };
    error?: string;
  }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/signal/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          requesterDeviceId: this.deviceId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Device not found" };
      }
      return { success: true, target: data.target };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error looking up code" };
    }
  }

  public async sendSignal(
    toDeviceId: string,
    type: SignalMessage["type"],
    data: any
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/signal/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromDeviceId: this.deviceId,
          fromDeviceName: this.deviceName,
          toDeviceId,
          type,
          data,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        return { success: false, error: resData.error || "Failed to deliver signal" };
      }
      return { success: true };
    } catch (err: any) {
      console.error(`Signaling send error for type ${type}:`, err);
      return { success: false, error: err.message || "Network error sending signal" };
    }
  }

  public start(
    onSignal: (signal: SignalMessage) => void,
    onError?: (err: Error) => void
  ) {
    this.onSignalReceivedCallback = onSignal;
    this.onErrorCallback = onError;

    if (this.isPolling) return;
    this.isPolling = true;

    // Start poll loop (every 1.5 seconds for responsive signaling)
    const poll = async () => {
      if (!this.isPolling) return;
      try {
        const res = await fetch(`${this.baseUrl}/api/signal/poll?deviceId=${encodeURIComponent(this.deviceId)}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.signals) && data.signals.length > 0) {
            for (const sig of data.signals) {
              if (this.onSignalReceivedCallback) {
                this.onSignalReceivedCallback(sig);
              }
            }
          }
        }
      } catch (err: any) {
        if (this.onErrorCallback) {
          this.onErrorCallback(err);
        }
      } finally {
        if (this.isPolling) {
          this.pollIntervalId = setTimeout(poll, 1500);
        }
      }
    };

    poll();

    // Heartbeat every 20 seconds
    this.heartbeatIntervalId = setInterval(() => {
      this.sendHeartbeat();
    }, 20000);
  }

  public stop() {
    this.isPolling = false;
    if (this.pollIntervalId) {
      clearTimeout(this.pollIntervalId);
      this.pollIntervalId = null;
    }
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }
}
