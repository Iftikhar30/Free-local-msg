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
  private eventSource: EventSource | null = null;
  private fastPollCount = 0;

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

  public triggerFastPolling(durationMs = 6000) {
    this.fastPollCount = Math.ceil(durationMs / 400);
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
      this.triggerFastPolling();
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

    // Start Server-Sent Events for zero-latency signal reception
    this.startSSE();

    if (this.isPolling) return;
    this.isPolling = true;

    // Adaptive polling loop (350ms during active handshake, 1200ms when idle)
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
          const nextInterval = this.fastPollCount > 0 ? 350 : 1200;
          if (this.fastPollCount > 0) this.fastPollCount--;
          this.pollIntervalId = setTimeout(poll, nextInterval);
        }
      }
    };

    poll();

    // Heartbeat every 20 seconds
    this.heartbeatIntervalId = setInterval(() => {
      this.sendHeartbeat();
    }, 20000);
  }

  private startSSE() {
    if (typeof window === "undefined" || !("EventSource" in window)) return;

    try {
      if (this.eventSource) {
        this.eventSource.close();
      }

      const sseUrl = `${this.baseUrl}/api/signal/events?deviceId=${encodeURIComponent(this.deviceId)}`;
      const es = new EventSource(sseUrl);
      this.eventSource = es;

      es.onmessage = (event) => {
        try {
          if (!event.data || event.data.trim() === "") return;
          const signal: SignalMessage = JSON.parse(event.data);
          if (signal && signal.type && this.onSignalReceivedCallback) {
            this.onSignalReceivedCallback(signal);
          }
        } catch (e) {
          console.warn("SSE parse signal error:", e);
        }
      };

      es.onerror = () => {
        // SSE connection dropped; polling loop continues seamlessly
      };
    } catch (e) {
      console.warn("SSE initialization error:", e);
    }
  }

  public stop() {
    this.isPolling = false;
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
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

