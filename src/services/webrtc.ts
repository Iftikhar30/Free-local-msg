import { ConnectedPeer, DataPacket, IceServerConfig, PeerConnectionStatus } from "../types";
import { getCustomIceServers } from "./device";

export interface WebRTCEventCallbacks {
  onPeerStatusChange: (peerId: string, status: PeerConnectionStatus, error?: string) => void;
  onDataChannelStateChange: (peerId: string, state: "connecting" | "open" | "closing" | "closed") => void;
  onPacketReceived: (peerId: string, packet: DataPacket) => void;
  onSignalNeeded: (toDeviceId: string, type: "offer" | "answer" | "ice-candidate" | "disconnect", data: any) => void;
  onLatencyMeasured?: (peerId: string, latencyMs: number) => void;
}

export class WebRTCManager {
  private myDeviceId: string;
  private myDeviceName: string;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private dataChannels = new Map<string, RTCDataChannel>();
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
  private callbacks: WebRTCEventCallbacks;
  private pingIntervals = new Map<string, any>();
  private pendingPings = new Map<string, number>(); // packetId -> sentTimestamp

  private serverIceServers: RTCIceServer[] = [];

  constructor(myDeviceId: string, myDeviceName: string, callbacks: WebRTCEventCallbacks) {
    this.myDeviceId = myDeviceId;
    this.myDeviceName = myDeviceName;
    this.callbacks = callbacks;
  }

  public setServerIceServers(servers: RTCIceServer[]) {
    if (Array.isArray(servers)) {
      this.serverIceServers = servers;
    }
  }

  public updateMyDeviceName(name: string) {
    this.myDeviceName = name;
  }

  private getRtcConfiguration(): RTCConfiguration {
    // High availability STUN server pool (Default: Multi-region Google + Cloudflare + Mozilla STUN pool)
    const defaultStunPool = [
      "stun:stun.l.google.com:19302",
      "stun:stun1.l.google.com:19302",
      "stun:stun2.l.google.com:19302",
      "stun:stun3.l.google.com:19302",
      "stun:stun4.l.google.com:19302",
      "stun:stun.cloudflare.com:3478",
      "stun:stun.services.mozilla.com",
    ];

    const envStun = (import.meta as any).env?.VITE_STUN_SERVERS;
    const stunUrls = (envStun && typeof envStun === "string" && envStun.trim())
      ? envStun.split(",").map((s: string) => s.trim()).filter(Boolean)
      : defaultStunPool;

    const iceServers: RTCIceServer[] = stunUrls.map((url: string) => ({ urls: url }));

    // Secure backend-delivered ICE servers (if configured on the server)
    if (this.serverIceServers.length > 0) {
      this.serverIceServers.forEach((s) => {
        if (s.urls) iceServers.push(s);
      });
    }

    // Optional client-side TURN server configuration
    const envTurn = (import.meta as any).env?.VITE_TURN_SERVER_URL;
    if (envTurn && typeof envTurn === "string" && envTurn.trim()) {
      const turnConfig: RTCIceServer = { urls: envTurn.trim() };
      const turnUser = (import.meta as any).env?.VITE_TURN_USERNAME;
      const turnCred = (import.meta as any).env?.VITE_TURN_CREDENTIAL;
      if (turnUser && typeof turnUser === "string" && turnUser.trim()) {
        turnConfig.username = turnUser.trim();
      }
      if (turnCred && typeof turnCred === "string" && turnCred.trim()) {
        turnConfig.credential = turnCred.trim();
      }
      iceServers.push(turnConfig);
    }

    // Custom user configured servers from Settings UI
    const custom = getCustomIceServers();
    if (Array.isArray(custom) && custom.length > 0) {
      custom.forEach((c) => {
        if (c.urls) iceServers.push(c);
      });
    }

    return {
      iceServers,
      iceCandidatePoolSize: 10,
    };
  }

  // Gracefully cleans up any existing stale connection objects for a peer
  public cleanupPeerConnection(peerId: string) {
    this.stopPingLoop(peerId);

    const channel = this.dataChannels.get(peerId);
    if (channel) {
      try {
        channel.onopen = null;
        channel.onclose = null;
        channel.onerror = null;
        channel.onmessage = null;
        if (channel.readyState !== "closed") {
          channel.close();
        }
      } catch {}
      this.dataChannels.delete(peerId);
    }

    const pc = this.peerConnections.get(peerId);
    if (pc) {
      try {
        pc.onicecandidate = null;
        pc.onconnectionstatechange = null;
        pc.oniceconnectionstatechange = null;
        pc.ondatachannel = null;
        if (pc.connectionState !== "closed") {
          pc.close();
        }
      } catch {}
      this.peerConnections.delete(peerId);
    }

    this.pendingCandidates.delete(peerId);
  }

  // Create a brand fresh RTCPeerConnection for a peer, cleaning up any previous stale objects
  private createFreshPeerConnection(peerId: string, isInitiator: boolean): RTCPeerConnection {
    this.cleanupPeerConnection(peerId);

    const config = this.getRtcConfiguration();
    const pc = new RTCPeerConnection(config);
    this.peerConnections.set(peerId, pc);

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.callbacks.onSignalNeeded(peerId, "ice-candidate", event.candidate.toJSON());
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") {
        this.callbacks.onPeerStatusChange(peerId, "connected");
        this.startPingLoop(peerId);
      } else if (state === "connecting") {
        this.callbacks.onPeerStatusChange(peerId, "connecting");
      } else if (state === "disconnected") {
        this.callbacks.onPeerStatusChange(peerId, "disconnected");
        this.stopPingLoop(peerId);
      } else if (state === "failed") {
        this.callbacks.onPeerStatusChange(peerId, "failed");
        this.stopPingLoop(peerId);
      } else if (state === "closed") {
        this.callbacks.onPeerStatusChange(peerId, "closed");
        this.stopPingLoop(peerId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      const iceState = pc.iceConnectionState;
      if (iceState === "failed" || iceState === "disconnected") {
        this.callbacks.onPeerStatusChange(peerId, iceState as PeerConnectionStatus);
      } else if (iceState === "connected" || iceState === "completed") {
        this.callbacks.onPeerStatusChange(peerId, "connected");
      }
    };

    // DataChannel handler (for answerer / receiver)
    pc.ondatachannel = (event) => {
      const channel = event.channel;
      this.setupDataChannel(peerId, channel);
    };

    if (isInitiator) {
      // Initiator creates the DataChannel
      const dataChannel = pc.createDataChannel("locallink-p2p", {
        ordered: true,
      });
      this.setupDataChannel(peerId, dataChannel);
    }

    return pc;
  }

  private setupDataChannel(peerId: string, channel: RTCDataChannel) {
    this.dataChannels.set(peerId, channel);

    try {
      channel.binaryType = "arraybuffer";
      channel.bufferedAmountLowThreshold = 64 * 1024; // 64KB threshold
    } catch {}

    channel.onopen = () => {
      this.callbacks.onDataChannelStateChange(peerId, "open");
      this.callbacks.onPeerStatusChange(peerId, "connected");
      this.startPingLoop(peerId);
    };

    channel.onclose = () => {
      this.callbacks.onDataChannelStateChange(peerId, "closed");
      this.callbacks.onPeerStatusChange(peerId, "disconnected");
      this.stopPingLoop(peerId);
    };

    channel.onerror = (err) => {
      console.warn(`DataChannel error with peer ${peerId}:`, err);
    };

    channel.onmessage = (event) => {
      try {
        if (typeof event.data === "string") {
          const packet: DataPacket = JSON.parse(event.data);
          this.handleIncomingDataPacket(peerId, packet);
        }
      } catch (err) {
        console.error("Failed to parse DataPacket JSON:", err);
      }
    };
  }

  // Wait for data channel buffer to drain before sending more chunks
  public async waitForBufferDrain(peerId: string, maxBuffered = 64 * 1024): Promise<void> {
    const channel = this.dataChannels.get(peerId);
    if (!channel || channel.readyState !== "open") return;

    if (channel.bufferedAmount <= maxBuffered) return;

    return new Promise<void>((resolve) => {
      const checkOrWait = () => {
        if (!channel || channel.readyState !== "open" || channel.bufferedAmount <= maxBuffered) {
          resolve();
        } else {
          channel.onbufferedamountlow = () => {
            channel.onbufferedamountlow = null;
            resolve();
          };
          // Fallback timeout in case onbufferedamountlow doesn't fire
          setTimeout(resolve, 50);
        }
      };
      checkOrWait();
    });
  }

  private handleIncomingDataPacket(peerId: string, packet: DataPacket) {
    // Handle internal ping/pong for real-time latency measurement
    if (packet.type === "ping") {
      this.sendDataPacket(peerId, {
        id: packet.id,
        type: "pong",
        timestamp: Date.now(),
        senderId: this.myDeviceId,
        senderName: this.myDeviceName,
        payload: { clientSent: packet.timestamp },
      });
      return;
    }

    if (packet.type === "pong") {
      const sentTime = this.pendingPings.get(packet.id);
      if (sentTime) {
        const rtt = Date.now() - sentTime;
        this.pendingPings.delete(packet.id);
        if (this.callbacks.onLatencyMeasured) {
          this.callbacks.onLatencyMeasured(peerId, rtt);
        }
      }
      return;
    }

    if (packet.type === "disconnect_notify") {
      this.disconnectPeer(peerId, false);
      return;
    }

    // Forward to messaging callbacks
    this.callbacks.onPacketReceived(peerId, packet);
  }

  // 1. Initiator creates Offer and sends to peer
  public async initiateConnection(peerId: string): Promise<void> {
    try {
      this.callbacks.onPeerStatusChange(peerId, "connecting");
      const pc = this.createFreshPeerConnection(peerId, true);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.callbacks.onSignalNeeded(peerId, "offer", {
        type: offer.type,
        sdp: offer.sdp,
      });
    } catch (err: any) {
      console.error("Error creating WebRTC offer:", err);
      this.callbacks.onPeerStatusChange(peerId, "failed", err.message);
    }
  }

  // 2. Receiver handles incoming Offer, sets remote description, creates Answer
  public async handleRemoteOffer(peerId: string, offerSdp: RTCSessionDescriptionInit): Promise<void> {
    try {
      this.callbacks.onPeerStatusChange(peerId, "connecting");
      const pc = this.createFreshPeerConnection(peerId, false);

      await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));

      // Process any buffered ICE candidates
      const queued = this.pendingCandidates.get(peerId) || [];
      for (const candidate of queued) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.warn);
      }
      this.pendingCandidates.delete(peerId);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.callbacks.onSignalNeeded(peerId, "answer", {
        type: answer.type,
        sdp: answer.sdp,
      });
    } catch (err: any) {
      console.error("Error handling remote offer:", err);
      this.callbacks.onPeerStatusChange(peerId, "failed", err.message);
    }
  }

  // Reconnect a peer by cleaning up and initiating a fresh offer
  public async reconnectPeer(peerId: string): Promise<void> {
    this.callbacks.onPeerStatusChange(peerId, "reconnecting");
    await this.initiateConnection(peerId);
  }

  // 3. Initiator handles incoming Answer
  public async handleRemoteAnswer(peerId: string, answerSdp: RTCSessionDescriptionInit): Promise<void> {
    try {
      const pc = this.peerConnections.get(peerId);
      if (!pc) return;

      await pc.setRemoteDescription(new RTCSessionDescription(answerSdp));

      // Process any buffered ICE candidates
      const queued = this.pendingCandidates.get(peerId) || [];
      for (const candidate of queued) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.warn);
      }
      this.pendingCandidates.delete(peerId);
    } catch (err: any) {
      console.error("Error handling remote answer:", err);
      this.callbacks.onPeerStatusChange(peerId, "failed", err.message);
    }
  }

  // 4. Handle incoming ICE candidate
  public async handleRemoteIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.peerConnections.get(peerId);
    if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) {
      // Buffer candidate until remote description is ready
      const list = this.pendingCandidates.get(peerId) || [];
      list.push(candidate);
      this.pendingCandidates.set(peerId, list);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn("Failed to add ICE candidate:", err);
    }
  }

  // Send a packet directly over RTCDataChannel
  public sendDataPacket(peerId: string, packet: DataPacket): boolean {
    const channel = this.dataChannels.get(peerId);
    if (channel && channel.readyState === "open") {
      try {
        channel.send(JSON.stringify(packet));
        return true;
      } catch (err) {
        console.error(`Failed to send data packet to ${peerId}:`, err);
        return false;
      }
    }
    return false;
  }

  // Latency ping loop
  private startPingLoop(peerId: string) {
    this.stopPingLoop(peerId);
    const interval = setInterval(() => {
      const channel = this.dataChannels.get(peerId);
      if (channel && channel.readyState === "open") {
        const pingId = `ping_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        this.pendingPings.set(pingId, Date.now());
        this.sendDataPacket(peerId, {
          id: pingId,
          type: "ping",
          timestamp: Date.now(),
          senderId: this.myDeviceId,
          senderName: this.myDeviceName,
          payload: {},
        });
      }
    }, 10000);
    this.pingIntervals.set(peerId, interval);
  }

  private stopPingLoop(peerId: string) {
    const interval = this.pingIntervals.get(peerId);
    if (interval) {
      clearInterval(interval);
      this.pingIntervals.delete(peerId);
    }
  }

  public isConnected(peerId: string): boolean {
    const channel = this.dataChannels.get(peerId);
    return channel !== undefined && channel.readyState === "open";
  }

  // Gracefully disconnect peer
  public disconnectPeer(peerId: string, notify = true) {
    if (notify) {
      this.sendDataPacket(peerId, {
        id: `disc_${Date.now()}`,
        type: "disconnect_notify",
        timestamp: Date.now(),
        senderId: this.myDeviceId,
        senderName: this.myDeviceName,
        payload: { reason: "user_disconnected" },
      });
    }

    this.stopPingLoop(peerId);

    const channel = this.dataChannels.get(peerId);
    if (channel) {
      channel.close();
      this.dataChannels.delete(peerId);
    }

    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }

    this.callbacks.onPeerStatusChange(peerId, "closed");
    this.callbacks.onDataChannelStateChange(peerId, "closed");
  }

  public disconnectAll() {
    for (const peerId of Array.from(this.peerConnections.keys())) {
      this.disconnectPeer(peerId, true);
    }
  }
}
