export type PeerConnectionStatus =
  | "new"
  | "connecting"
  | "reconnecting"
  | "connected"
  | "disconnected"
  | "failed"
  | "closed";

export type AppTab = "home" | "devices" | "chat" | "settings" | "about";

export type DeviceType = "phone" | "laptop" | "desktop" | "tablet" | "unknown";

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceType: DeviceType;
  os: string;
  browser: string;
  userAgent: string;
}

export interface ConnectedPeer {
  deviceId: string;
  deviceName: string;
  deviceType: DeviceType;
  os?: string;
  connectionCode?: string;
  status: PeerConnectionStatus;
  dataChannelStatus: "connecting" | "open" | "closing" | "closed";
  connectedAt?: number;
  lastSeen: number;
  latencyMs?: number;
  isInitiator: boolean;
  unreadCount: number;
  lastMessage?: ChatMessage;
  iceCandidateType?: "host" | "srflx" | "relay" | "unknown"; // local LAN (host), STUN (srflx), or TURN (relay)
}

export interface IncomingConnectionRequest {
  id: string;
  fromDeviceId: string;
  fromDeviceName: string;
  timestamp: number;
  data?: any;
}

export interface ChatMessage {
  id: string;
  fromDeviceId: string;
  toDeviceId: string;
  text: string;
  timestamp: number;
  status: "sending" | "sent" | "delivered" | "read" | "failed";
  isMine: boolean;
  type?: "text" | "file_info";
  fileMetadata?: {
    name: string;
    size: number;
    mimeType: string;
  };
}

export type DataPacketType =
  | "text"
  | "delivery_ack"
  | "read_ack"
  | "typing"
  | "ping"
  | "pong"
  | "file_offer"
  | "file_chunk"
  | "file_ack"
  | "disconnect_notify";

export interface DataPacket {
  id: string;
  type: DataPacketType;
  timestamp: number;
  senderId: string;
  senderName: string;
  payload: any;
}

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface SignalMessage {
  id: string;
  fromDeviceId: string;
  fromDeviceName: string;
  toDeviceId: string;
  type:
    | "connect_request"
    | "connect_response"
    | "offer"
    | "answer"
    | "ice-candidate"
    | "disconnect";
  data: any;
  timestamp: number;
}
