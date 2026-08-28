import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import webpush from "web-push";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize VAPID Keys for Web Push Notifications
let vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || "",
  privateKey: process.env.VAPID_PRIVATE_KEY || "",
};

if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  // Generate a persistent in-process VAPID keypair if not configured in env
  const generated = webpush.generateVAPIDKeys();
  vapidKeys = {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
  };
  console.log("[LocalLink] Generated VAPID Keys for Background Push Notifications");
}

try {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || "mailto:support@locallink.app",
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
} catch (err) {
  console.warn("[LocalLink] Failed to configure VAPID details:", err);
}

// In-memory signaling registry with TTL
interface DeviceRegistration {
  deviceId: string;
  code: string;
  deviceName: string;
  userAgent?: string;
  lastSeen: number;
}

interface PushSubscriptionRecord {
  deviceId: string;
  deviceName?: string;
  subscription: webpush.PushSubscription;
  timestamp: number;
}

interface SignalEnvelope {
  id: string;
  fromDeviceId: string;
  fromDeviceName: string;
  toDeviceId: string;
  type: string; // 'connect_request' | 'connect_response' | 'offer' | 'answer' | 'ice-candidate' | 'disconnect'
  data: any;
  timestamp: number;
}

// Stores
const devicesByCode = new Map<string, DeviceRegistration>();
const devicesById = new Map<string, DeviceRegistration>();
const signalMailbox = new Map<string, SignalEnvelope[]>(); // toDeviceId -> signals[]
const sseClients = new Map<string, Set<express.Response>>(); // deviceId -> Set of open SSE responses
const pushSubscriptions = new Map<string, PushSubscriptionRecord>(); // deviceId -> PushSubscriptionRecord

const CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes of inactivity before code expiration
const SIGNAL_TTL_MS = 2 * 60 * 1000; // 2 minutes for queued signals

// Cleanup stale registrations & signals every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [code, device] of devicesByCode.entries()) {
    if (now - device.lastSeen > CODE_TTL_MS) {
      devicesByCode.delete(code);
      devicesById.delete(device.deviceId);
      signalMailbox.delete(device.deviceId);
      sseClients.delete(device.deviceId);
    }
  }

  for (const [deviceId, signals] of signalMailbox.entries()) {
    const fresh = signals.filter((s) => now - s.timestamp < SIGNAL_TTL_MS);
    if (fresh.length === 0) {
      signalMailbox.delete(deviceId);
    } else {
      signalMailbox.set(deviceId, fresh);
    }
  }
}, 30000);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "5mb" }));

  // CORS headers for flexibility
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Health endpoint
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      activeDevices: devicesById.size,
      uptime: process.uptime(),
      timestamp: Date.now(),
    });
  });

  // 1. Register or update device code
  app.post("/api/signal/register", (req, res) => {
    const { deviceId, code, deviceName, userAgent } = req.body;

    if (!deviceId || !code || !deviceName) {
      return res.status(400).json({ error: "Missing deviceId, code, or deviceName" });
    }

    const cleanCode = String(code).trim().toUpperCase();

    // Check if code is already registered by a different device
    const existing = devicesByCode.get(cleanCode);
    if (existing && existing.deviceId !== deviceId) {
      // Code collision, request client to generate a new one
      return res.status(409).json({ error: "Code already in use by another active peer", codeTaken: true });
    }

    // Clean up any previous code registered for this deviceId
    const oldReg = devicesById.get(deviceId);
    if (oldReg && oldReg.code !== cleanCode) {
      devicesByCode.delete(oldReg.code);
    }

    const registration: DeviceRegistration = {
      deviceId,
      code: cleanCode,
      deviceName: String(deviceName).trim(),
      userAgent: userAgent || req.headers["user-agent"],
      lastSeen: Date.now(),
    };

    devicesByCode.set(cleanCode, registration);
    devicesById.set(deviceId, registration);

    if (!signalMailbox.has(deviceId)) {
      signalMailbox.set(deviceId, []);
    }

    res.json({
      success: true,
      registered: registration,
      expiresInSeconds: Math.floor(CODE_TTL_MS / 1000),
    });
  });

  // 2. Heartbeat to refresh TTL
  app.post("/api/signal/heartbeat", (req, res) => {
    const { deviceId } = req.body;
    if (!deviceId) return res.status(400).json({ error: "Missing deviceId" });

    const device = devicesById.get(deviceId);
    if (device) {
      device.lastSeen = Date.now();
      devicesByCode.set(device.code, device);
      return res.json({ success: true, active: true });
    }
    return res.status(404).json({ error: "Device registration not found or expired", expired: true });
  });

  // 3. Lookup target device by 6-char connection code
  app.post("/api/signal/lookup", (req, res) => {
    const { code, requesterDeviceId } = req.body;
    if (!code) return res.status(400).json({ error: "Missing connection code" });

    const cleanCode = String(code).trim().toUpperCase();
    const target = devicesByCode.get(cleanCode);

    if (!target) {
      return res.status(404).json({ error: "No active device found with this connection code" });
    }

    if (requesterDeviceId && target.deviceId === requesterDeviceId) {
      return res.status(400).json({ error: "Cannot connect to your own device code" });
    }

    // Check if target has expired
    if (Date.now() - target.lastSeen > CODE_TTL_MS) {
      devicesByCode.delete(cleanCode);
      devicesById.delete(target.deviceId);
      return res.status(404).json({ error: "Device connection code has expired" });
    }

    res.json({
      success: true,
      target: {
        deviceId: target.deviceId,
        deviceName: target.deviceName,
        code: target.code,
      },
    });
  });

  // 4. Send a signaling message to target peer
  app.post("/api/signal/send", (req, res) => {
    const { fromDeviceId, fromDeviceName, toDeviceId, type, data } = req.body;

    if (!fromDeviceId || !toDeviceId || !type) {
      return res.status(400).json({ error: "Missing required signal fields" });
    }

    const envelope: SignalEnvelope = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      fromDeviceId,
      fromDeviceName: fromDeviceName || "Unknown Device",
      toDeviceId,
      type,
      data,
      timestamp: Date.now(),
    };

    // Instant SSE push if target device has active SSE listeners
    const targetClients = sseClients.get(toDeviceId);
    if (targetClients && targetClients.size > 0) {
      const payload = `data: ${JSON.stringify(envelope)}\n\n`;
      targetClients.forEach((clientRes) => {
        try {
          clientRes.write(payload);
        } catch {}
      });
    }

    // Also queue in mailbox for poll drainage and reliable delivery
    const targetQueue = signalMailbox.get(toDeviceId) || [];
    targetQueue.push(envelope);
    signalMailbox.set(toDeviceId, targetQueue);

    // Helper function for sending Web Push notifications
    const sendPushNotification = async (targetDeviceId: string, payload: any) => {
      const record = pushSubscriptions.get(targetDeviceId);
      if (!record || !record.subscription) return false;
      try {
        await webpush.sendNotification(record.subscription, JSON.stringify(payload));
        return true;
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          pushSubscriptions.delete(targetDeviceId);
        }
        console.warn(`[LocalLink] Push Notification Delivery error to ${targetDeviceId}:`, err.message);
        return false;
      }
    };

    // Trigger Web Push Notification if recipient might be in background or has app closed
    if (type === "connect_request") {
      sendPushNotification(toDeviceId, {
        title: `🔗 Connection Request: ${fromDeviceName}`,
        body: `${fromDeviceName} wants to connect with your device. Tap to accept.`,
        type: "connect",
        peerId: fromDeviceId,
        url: `/?connect=${fromDeviceId}`,
      });
    } else if (type === "call_request" || (type === "offer" && data?.callId)) {
      sendPushNotification(toDeviceId, {
        title: `📞 Incoming Voice Call: ${fromDeviceName}`,
        body: `Incoming encrypted voice call from ${fromDeviceName}. Tap to answer.`,
        type: "call",
        callId: data?.callId || "",
        peerId: fromDeviceId,
        url: `/?call=${data?.callId || ""}&peer=${fromDeviceId}`,
      });
    } else if (type === "chat_message") {
      sendPushNotification(toDeviceId, {
        title: `💬 Message from ${fromDeviceName}`,
        body: data?.text || "Sent you a message or attachment.",
        type: "message",
        peerId: fromDeviceId,
        url: `/?peer=${fromDeviceId}`,
      });
    }

    res.json({ success: true, signalId: envelope.id });
  });

  // Push Notification Endpoints
  // A. Get Public VAPID Key
  app.get("/api/push/vapid-public-key", (req, res) => {
    res.json({
      success: true,
      publicKey: vapidKeys.publicKey,
    });
  });

  // B. Register Push Subscription
  app.post("/api/push/subscribe", (req, res) => {
    const { deviceId, deviceName, subscription } = req.body;
    if (!deviceId || !subscription || !subscription.endpoint) {
      return res.status(400).json({ error: "Missing deviceId or valid push subscription" });
    }

    pushSubscriptions.set(deviceId, {
      deviceId,
      deviceName,
      subscription,
      timestamp: Date.now(),
    });

    console.log(`[LocalLink] Registered Web Push Subscription for device ${deviceId} (${deviceName || "Unnamed"})`);
    res.json({ success: true, registered: true });
  });

  // C. Unsubscribe from Push
  app.post("/api/push/unsubscribe", (req, res) => {
    const { deviceId } = req.body;
    if (deviceId) {
      pushSubscriptions.delete(deviceId);
    }
    res.json({ success: true, unsubscribed: true });
  });

  // D. Send Test Push Notification
  app.post("/api/push/test", async (req, res) => {
    const { deviceId } = req.body;
    if (!deviceId) return res.status(400).json({ error: "Missing deviceId" });

    const record = pushSubscriptions.get(deviceId);
    if (!record) {
      return res.status(404).json({
        error: "No push subscription registered for this device. Please enable notifications first.",
      });
    }

    try {
      await webpush.sendNotification(
        record.subscription,
        JSON.stringify({
          title: "🔔 LocalLink Notification Test",
          body: "Push Notifications are working! You will receive calls and messages even if this tab is closed.",
          type: "test",
          url: "/",
        })
      );
      res.json({ success: true, message: "Test notification sent successfully" });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to send test push notification: " + err.message });
    }
  });

  // E. Manually trigger a peer notification
  app.post("/api/push/notify", async (req, res) => {
    const { toDeviceId, type, fromDeviceName, text, callId } = req.body;
    if (!toDeviceId) return res.status(400).json({ error: "Missing toDeviceId" });

    const record = pushSubscriptions.get(toDeviceId);
    if (!record) {
      return res.json({ success: false, notRegistered: true });
    }

    let payload: any = {
      title: "LocalLink",
      body: "You have a new alert",
      type: type || "generic",
      url: "/",
    };

    if (type === "call") {
      payload = {
        title: `📞 Incoming Call from ${fromDeviceName || "Peer"}`,
        body: "Tap to answer incoming voice call on LocalLink",
        type: "call",
        callId,
        url: `/?call=${callId || ""}`,
      };
    } else if (type === "message") {
      payload = {
        title: `💬 Message from ${fromDeviceName || "Peer"}`,
        body: text || "Sent you a message.",
        type: "message",
        url: "/",
      };
    } else if (type === "connect") {
      payload = {
        title: `🔗 Connection Request from ${fromDeviceName || "Peer"}`,
        body: "Wants to connect with your device.",
        type: "connect",
        url: "/",
      };
    }

    try {
      await webpush.sendNotification(record.subscription, JSON.stringify(payload));
      res.json({ success: true });
    } catch (err: any) {
      res.json({ success: false, error: err.message });
    }
  });

  // Explicit Service Worker and Manifest endpoints with correct headers
  app.get("/sw.js", (req, res) => {
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Service-Worker-Allowed", "/");
    res.sendFile(path.join(process.cwd(), "public", "sw.js"));
  });

  app.get("/manifest.json", (req, res) => {
    res.setHeader("Content-Type", "application/manifest+json");
    res.sendFile(path.join(process.cwd(), "public", "manifest.json"));
  });

  // 5. Server-Sent Events (SSE) stream for zero-latency instant signaling
  app.get("/api/signal/events", (req, res) => {
    const deviceId = req.query.deviceId as string;
    if (!deviceId) return res.status(400).json({ error: "Missing deviceId query parameter" });

    // Refresh lastSeen
    const reg = devicesById.get(deviceId);
    if (reg) {
      reg.lastSeen = Date.now();
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    res.write(`: connected\n\n`);

    // Register SSE client
    let clientSet = sseClients.get(deviceId);
    if (!clientSet) {
      clientSet = new Set();
      sseClients.set(deviceId, clientSet);
    }
    clientSet.add(res);

    // Flush any pending mailbox signals immediately
    const queued = signalMailbox.get(deviceId) || [];
    if (queued.length > 0) {
      signalMailbox.set(deviceId, []);
      for (const env of queued) {
        res.write(`data: ${JSON.stringify(env)}\n\n`);
      }
    }

    // Keepalive ping every 15s to prevent proxy timeouts
    const keepAliveTimer = setInterval(() => {
      try {
        res.write(`: ping\n\n`);
      } catch {
        clearInterval(keepAliveTimer);
      }
    }, 15000);

    req.on("close", () => {
      clearInterval(keepAliveTimer);
      const currentSet = sseClients.get(deviceId);
      if (currentSet) {
        currentSet.delete(res);
        if (currentSet.size === 0) {
          sseClients.delete(deviceId);
        }
      }
    });
  });

  // 6. Poll for signals addressed to deviceId (Fallback)
  app.get("/api/signal/poll", (req, res) => {
    const deviceId = req.query.deviceId as string;
    if (!deviceId) return res.status(400).json({ error: "Missing deviceId query parameter" });

    // Refresh lastSeen on poll
    const reg = devicesById.get(deviceId);
    if (reg) {
      reg.lastSeen = Date.now();
    }

    const queue = signalMailbox.get(deviceId) || [];
    // Drain the mailbox for this device
    signalMailbox.set(deviceId, []);

    res.json({
      success: true,
      signals: queue,
      timestamp: Date.now(),
    });
  });

  // 7. Secure ICE Server configuration endpoint
  // STUN pool is returned by default for direct P2P testing without requiring TURN.
  const getServerIceServers = () => {
    const defaultStuns = [
      "stun:stun.l.google.com:19302",
      "stun:stun1.l.google.com:19302",
      "stun:stun2.l.google.com:19302",
      "stun:stun3.l.google.com:19302",
      "stun:stun4.l.google.com:19302",
      "stun:stun.cloudflare.com:3478",
      "stun:stun.services.mozilla.com",
    ];

    const stunString = process.env.STUN_SERVERS || process.env.VITE_STUN_SERVERS;
    const stunUrls = stunString
      ? stunString.split(",").map((s) => s.trim()).filter(Boolean)
      : defaultStuns;

    const iceServers: any[] = stunUrls.map((url) => ({ urls: url }));

    const turnUrl = process.env.TURN_SERVER_URL || process.env.TURN_URL;
    if (turnUrl && turnUrl.trim()) {
      const turnConfig: any = { urls: turnUrl.trim() };
      const turnUsername = process.env.TURN_USERNAME;
      const turnCredential = process.env.TURN_CREDENTIAL || process.env.TURN_PASSWORD || process.env.TURN_SECRET;
      if (turnUsername) turnConfig.username = turnUsername.trim();
      if (turnCredential) turnConfig.credential = turnCredential.trim();
      iceServers.push(turnConfig);
    }

    return iceServers;
  };


  app.get("/api/signal/ice-servers", (req, res) => {
    res.json({
      success: true,
      iceServers: getServerIceServers(),
    });
  });

  app.get("/api/ice-servers", (req, res) => {
    res.json({
      success: true,
      iceServers: getServerIceServers(),
    });
  });

  // Vite middleware for development vs static dist in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[LocalLink] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
