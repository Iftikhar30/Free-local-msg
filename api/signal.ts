// Vercel Serverless Function entry point for signaling
// This allows LocalLink to be deployed directly to Vercel without a custom server.

interface DeviceRegistration {
  deviceId: string;
  code: string;
  deviceName: string;
  userAgent?: string;
  lastSeen: number;
}

interface SignalEnvelope {
  id: string;
  fromDeviceId: string;
  fromDeviceName: string;
  toDeviceId: string;
  type: string;
  data: any;
  timestamp: number;
}

// Global in-memory maps (in serverless, state is kept alive within warm instances,
// or clients can optionally plug in Redis/KV if ultra-distributed scaling is needed)
const globalStore = globalThis as unknown as {
  __locallink_devicesByCode?: Map<string, DeviceRegistration>;
  __locallink_devicesById?: Map<string, DeviceRegistration>;
  __locallink_signalMailbox?: Map<string, SignalEnvelope[]>;
};

if (!globalStore.__locallink_devicesByCode) {
  globalStore.__locallink_devicesByCode = new Map();
  globalStore.__locallink_devicesById = new Map();
  globalStore.__locallink_signalMailbox = new Map();
}

const devicesByCode = globalStore.__locallink_devicesByCode;
const devicesById = globalStore.__locallink_devicesById;
const signalMailbox = globalStore.__locallink_signalMailbox;

const CODE_TTL_MS = 15 * 60 * 1000;

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { action } = req.query;

  // 1. Register
  if (req.method === "POST" && action === "register") {
    const { deviceId, code, deviceName, userAgent } = req.body || {};
    if (!deviceId || !code || !deviceName) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const cleanCode = String(code).trim().toUpperCase();

    const existing = devicesByCode.get(cleanCode);
    if (existing && existing.deviceId !== deviceId && Date.now() - existing.lastSeen < CODE_TTL_MS) {
      return res.status(409).json({ error: "Code in use", codeTaken: true });
    }

    const reg: DeviceRegistration = {
      deviceId,
      code: cleanCode,
      deviceName: String(deviceName).trim(),
      userAgent,
      lastSeen: Date.now(),
    };

    devicesByCode.set(cleanCode, reg);
    devicesById.set(deviceId, reg);
    if (!signalMailbox.has(deviceId)) signalMailbox.set(deviceId, []);

    return res.json({ success: true, registered: reg });
  }

  // 2. Heartbeat
  if (req.method === "POST" && action === "heartbeat") {
    const { deviceId } = req.body || {};
    if (!deviceId) return res.status(400).json({ error: "Missing deviceId" });

    const device = devicesById.get(deviceId);
    if (device) {
      device.lastSeen = Date.now();
      devicesByCode.set(device.code, device);
      return res.json({ success: true, active: true });
    }
    return res.status(404).json({ error: "Device registration not found or expired", expired: true });
  }

  // 3. Lookup
  if (req.method === "POST" && action === "lookup") {
    const { code, requesterDeviceId } = req.body || {};
    if (!code) return res.status(400).json({ error: "Missing code" });
    const cleanCode = String(code).trim().toUpperCase();
    const target = devicesByCode.get(cleanCode);

    if (!target || Date.now() - target.lastSeen > CODE_TTL_MS) {
      return res.status(404).json({ error: "Device code not found or expired" });
    }
    if (requesterDeviceId && target.deviceId === requesterDeviceId) {
      return res.status(400).json({ error: "Cannot connect to yourself" });
    }

    return res.json({
      success: true,
      target: {
        deviceId: target.deviceId,
        deviceName: target.deviceName,
        code: target.code,
      },
    });
  }

  // 4. Send Signal
  if (req.method === "POST" && action === "send") {
    const { fromDeviceId, fromDeviceName, toDeviceId, type, data } = req.body || {};
    if (!fromDeviceId || !toDeviceId || !type) {
      return res.status(400).json({ error: "Missing signal data" });
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

    const targetQueue = signalMailbox.get(toDeviceId) || [];
    targetQueue.push(envelope);
    signalMailbox.set(toDeviceId, targetQueue);

    return res.json({ success: true, signalId: envelope.id });
  }

  // 5. Poll Signals
  if (req.method === "GET" && action === "poll") {
    const deviceId = req.query.deviceId as string;
    if (!deviceId) return res.status(400).json({ error: "Missing deviceId" });

    const reg = devicesById.get(deviceId);
    if (reg) reg.lastSeen = Date.now();

    const queue = signalMailbox.get(deviceId) || [];
    signalMailbox.set(deviceId, []);

    return res.json({ success: true, signals: queue, timestamp: Date.now() });
  }

  // 6. Secure ICE Server Configuration (STUN default, optional server-side TURN)
  if (req.method === "GET" && action === "ice-servers") {
    const stunString = process.env.STUN_SERVERS || process.env.VITE_STUN_SERVERS || "stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302,stun:stun2.l.google.com:19302";
    const stunUrls = stunString.split(",").map((s) => s.trim()).filter(Boolean);
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

    return res.json({ success: true, iceServers });
  }

  // Health
  return res.json({
    status: "ok",
    service: "LocalLink Vercel Signaling",
    activeDevices: devicesById.size,
    timestamp: Date.now(),
  });
}
