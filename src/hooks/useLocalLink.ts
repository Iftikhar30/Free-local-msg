import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChatMessage,
  ConnectedPeer,
  DeviceInfo,
  IncomingConnectionRequest,
  PeerConnectionStatus,
  SignalMessage,
} from "../types";
import {
  detectDeviceEnvironment,
  generateConnectionCode,
  getDeviceInfo,
  setStoredDeviceName,
} from "../services/device";
import { MessagingService } from "../services/messaging";
import { SignalingClient } from "../services/signaling";
import { WebRTCManager } from "../services/webrtc";

// Subtle Web Audio tone generator for incoming messages / requests
function playBeep(frequency = 600, duration = 0.15) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Ignore audio permission restrictions
  }
}

export function useLocalLink() {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => getDeviceInfo());
  const [connectionCode, setConnectionCode] = useState<string>(() => generateConnectionCode());
  const [isSignalingReady, setIsSignalingReady] = useState(false);
  const [signalingError, setSignalingError] = useState<string | null>(null);

  // Connected peers list
  const [peers, setPeers] = useState<Map<string, ConnectedPeer>>(new Map<string, ConnectedPeer>());
  const [activePeerId, setActivePeerId] = useState<string | null>(null);

  // Messages map: peerId -> ChatMessage[]
  const [chatHistories, setChatHistories] = useState<Map<string, ChatMessage[]>>(new Map<string, ChatMessage[]>());

  // Typing status: peerId -> boolean
  const [typingPeers, setTypingPeers] = useState<Map<string, boolean>>(new Map<string, boolean>());

  // Incoming connection requests
  const [incomingRequests, setIncomingRequests] = useState<IncomingConnectionRequest[]>([]);

  // Sound enabled
  const [soundEnabled, setSoundEnabled] = useState(true);

  // References to keep callbacks current without re-instantiating services
  const signalingClientRef = useRef<SignalingClient | null>(null);
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);
  const messagingServiceRef = useRef<MessagingService | null>(null);

  // 1. Initialize Signaling, WebRTC, and Messaging services
  useEffect(() => {
    const signaling = new SignalingClient(deviceInfo.deviceId, deviceInfo.deviceName);
    signalingClientRef.current = signaling;

    const webrtc = new WebRTCManager(deviceInfo.deviceId, deviceInfo.deviceName, {
      onPeerStatusChange: (peerId: string, status: PeerConnectionStatus) => {
        setPeers((prev) => {
          const next = new Map<string, ConnectedPeer>(prev);
          const peer = next.get(peerId);
          if (peer) {
            next.set(peerId, {
              ...peer,
              status,
              connectedAt: status === "connected" ? Date.now() : peer.connectedAt,
              lastSeen: Date.now(),
            });
          }
          return next;
        });
      },
      onDataChannelStateChange: (peerId: string, state: "connecting" | "open" | "closing" | "closed") => {
        setPeers((prev) => {
          const next = new Map<string, ConnectedPeer>(prev);
          const peer = next.get(peerId);
          if (peer) {
            next.set(peerId, {
              ...peer,
              dataChannelStatus: state,
              status: state === "open" ? "connected" : peer.status,
            });
          }
          return next;
        });
      },
      onPacketReceived: (peerId: string, packet: any) => {
        messagingServiceRef.current?.handleIncomingPacket(peerId, packet);
      },
      onSignalNeeded: (toDeviceId: string, type: any, data: any) => {
        signalingClientRef.current?.sendSignal(toDeviceId, type, data);
      },
      onLatencyMeasured: (peerId: string, latencyMs: number) => {
        setPeers((prev) => {
          const next = new Map<string, ConnectedPeer>(prev);
          const peer = next.get(peerId);
          if (peer) {
            next.set(peerId, { ...peer, latencyMs, lastSeen: Date.now() });
          }
          return next;
        });
      },
    });
    webrtcManagerRef.current = webrtc;

    const messaging = new MessagingService(webrtc, deviceInfo.deviceId, deviceInfo.deviceName, {
      onMessageReceived: (msg: ChatMessage) => {
        if (soundEnabled) playBeep(750, 0.18);

        setChatHistories((prev) => {
          const next = new Map<string, ChatMessage[]>(prev);
          const list = next.get(msg.fromDeviceId) || [];
          next.set(msg.fromDeviceId, [...list, msg]);
          return next;
        });

        setPeers((prev) => {
          const next = new Map<string, ConnectedPeer>(prev);
          const peer = next.get(msg.fromDeviceId);
          if (peer) {
            const isCurrentChat = activePeerId === msg.fromDeviceId;
            next.set(msg.fromDeviceId, {
              ...peer,
              lastMessage: msg,
              lastSeen: Date.now(),
              unreadCount: isCurrentChat ? 0 : peer.unreadCount + 1,
            });
          }
          return next;
        });
      },
      onMessageStatusUpdated: (msgId: string, status: ChatMessage["status"]) => {
        setChatHistories((prev) => {
          const next = new Map<string, ChatMessage[]>(prev);
          for (const [peerId, list] of next.entries()) {
            const index = list.findIndex((m) => m.id === msgId);
            if (index >= 0) {
              const updated = [...list];
              updated[index] = { ...updated[index], status };
              next.set(peerId, updated);
            }
          }
          return next;
        });
      },
      onTypingState: (peerId: string, isTyping: boolean) => {
        setTypingPeers((prev) => {
          const next = new Map<string, boolean>(prev);
          next.set(peerId, isTyping);
          return next;
        });
      },
    });
    messagingServiceRef.current = messaging;

    // Register our code on signaling server
    const registerDevice = async () => {
      const res = await signaling.register(connectionCode);
      if (res.success) {
        setIsSignalingReady(true);
        setSignalingError(null);
      } else {
        if (res.codeTaken) {
          const newCode = generateConnectionCode();
          setConnectionCode(newCode);
        } else {
          setSignalingError(res.error || "Failed to connect to signaling server");
        }
      }
    };

    registerDevice();

    // Fetch server-provided ICE servers asynchronously if backend has secure TURN configured
    signaling.fetchIceServers().then((servers) => {
      if (servers && servers.length > 0) {
        webrtc.setServerIceServers(servers);
      }
    });

    // Start signaling polling
    signaling.start((signal: SignalMessage) => {
      handleIncomingSignal(signal);
    });

    return () => {
      signaling.stop();
      webrtc.disconnectAll();
    };
  }, [connectionCode, deviceInfo.deviceId]);

  // Handle incoming signaling messages
  const handleIncomingSignal = async (signal: SignalMessage) => {
    switch (signal.type) {
      case "connect_request": {
        if (soundEnabled) playBeep(520, 0.25);
        setIncomingRequests((prev) => {
          // Avoid duplicate requests from same peer
          if (prev.some((r) => r.fromDeviceId === signal.fromDeviceId)) {
            return prev;
          }
          return [
            ...prev,
            {
              id: signal.id,
              fromDeviceId: signal.fromDeviceId,
              fromDeviceName: signal.fromDeviceName,
              timestamp: signal.timestamp,
              data: signal.data,
            },
          ];
        });
        break;
      }

      case "connect_response": {
        const { accepted, deviceType, os } = signal.data || {};
        if (accepted) {
          // Target accepted! Create peer record and initiate WebRTC offer
          setPeers((prev) => {
            const next = new Map<string, ConnectedPeer>(prev);
            next.set(signal.fromDeviceId, {
              deviceId: signal.fromDeviceId,
              deviceName: signal.fromDeviceName,
              deviceType: deviceType || "desktop",
              os,
              status: "connecting",
              dataChannelStatus: "connecting",
              lastSeen: Date.now(),
              isInitiator: true,
              unreadCount: 0,
            });
            return next;
          });

          // Load local history if any
          const history = messagingServiceRef.current?.getChatHistory(signal.fromDeviceId) || [];
          setChatHistories((prev) => {
            const next = new Map<string, ChatMessage[]>(prev);
            next.set(signal.fromDeviceId, history);
            return next;
          });

          // Initiate WebRTC negotiation
          webrtcManagerRef.current?.initiateConnection(signal.fromDeviceId);
        } else {
          // Connection rejected
          setPeers((prev) => {
            const next = new Map<string, ConnectedPeer>(prev);
            next.delete(signal.fromDeviceId);
            return next;
          });
        }
        break;
      }

      case "offer": {
        // Target sent an offer
        await webrtcManagerRef.current?.handleRemoteOffer(signal.fromDeviceId, signal.data);
        break;
      }

      case "answer": {
        // Target sent an answer
        await webrtcManagerRef.current?.handleRemoteAnswer(signal.fromDeviceId, signal.data);
        break;
      }

      case "ice-candidate": {
        await webrtcManagerRef.current?.handleRemoteIceCandidate(signal.fromDeviceId, signal.data);
        break;
      }

      case "disconnect": {
        webrtcManagerRef.current?.disconnectPeer(signal.fromDeviceId, false);
        setPeers((prev) => {
          const next = new Map<string, ConnectedPeer>(prev);
          const peer = next.get(signal.fromDeviceId);
          if (peer) {
            next.set(signal.fromDeviceId, { ...peer, status: "disconnected", dataChannelStatus: "closed" });
          }
          return next;
        });
        break;
      }
    }
  };

  // Update Device Name
  const updateDeviceName = (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setStoredDeviceName(trimmed);
    const updated = { ...deviceInfo, deviceName: trimmed };
    setDeviceInfo(updated);

    signalingClientRef.current?.updateDeviceName(trimmed);
    webrtcManagerRef.current?.updateMyDeviceName(trimmed);
    messagingServiceRef.current?.updateMyDeviceName(trimmed);

    // Re-register on signaling server with updated name
    signalingClientRef.current?.register(connectionCode);
  };

  // Regenerate Connection Code
  const regenerateCode = async () => {
    const newCode = generateConnectionCode();
    setConnectionCode(newCode);
    if (signalingClientRef.current) {
      await signalingClientRef.current.register(newCode);
    }
  };

  // Request connection to a peer by their 6-char code
  const connectByCode = async (code: string): Promise<{ success: boolean; error?: string }> => {
    if (!signalingClientRef.current) {
      return { success: false, error: "Signaling client not ready" };
    }

    const cleanCode = code.trim().toUpperCase();
    if (cleanCode === connectionCode) {
      return { success: false, error: "Cannot connect to your own device code." };
    }

    const lookup = await signalingClientRef.current.lookupCode(cleanCode);
    if (!lookup.success || !lookup.target) {
      return { success: false, error: lookup.error || "Device not found or code expired." };
    }

    const target = lookup.target;

    // Track peer as connecting
    setPeers((prev) => {
      const next = new Map<string, ConnectedPeer>(prev);
      next.set(target.deviceId, {
        deviceId: target.deviceId,
        deviceName: target.deviceName,
        deviceType: "desktop",
        connectionCode: target.code,
        status: "connecting",
        dataChannelStatus: "connecting",
        lastSeen: Date.now(),
        isInitiator: true,
        unreadCount: 0,
      });
      return next;
    });

    // Send connection request
    const env = detectDeviceEnvironment();
    await signalingClientRef.current.sendSignal(target.deviceId, "connect_request", {
      code: target.code,
      deviceType: env.deviceType,
      os: env.os,
    });

    return { success: true };
  };

  // Accept incoming connection request
  const acceptConnectionRequest = async (requestId: string) => {
    const request = incomingRequests.find((r) => r.id === requestId);
    if (!request) return;

    setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId));

    const env = detectDeviceEnvironment();

    // Create peer record
    setPeers((prev) => {
      const next = new Map<string, ConnectedPeer>(prev);
      next.set(request.fromDeviceId, {
        deviceId: request.fromDeviceId,
        deviceName: request.fromDeviceName,
        deviceType: request.data?.deviceType || "desktop",
        os: request.data?.os,
        status: "connecting",
        dataChannelStatus: "connecting",
        lastSeen: Date.now(),
        isInitiator: false,
        unreadCount: 0,
      });
      return next;
    });

    // Load history
    const history = messagingServiceRef.current?.getChatHistory(request.fromDeviceId) || [];
    setChatHistories((prev) => {
      const next = new Map<string, ChatMessage[]>(prev);
      next.set(request.fromDeviceId, history);
      return next;
    });

    // Send positive response back to initiator
    await signalingClientRef.current?.sendSignal(request.fromDeviceId, "connect_response", {
      accepted: true,
      deviceType: env.deviceType,
      os: env.os,
    });
  };

  // Reject incoming connection request
  const rejectConnectionRequest = async (requestId: string) => {
    const request = incomingRequests.find((r) => r.id === requestId);
    if (!request) return;

    setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId));

    await signalingClientRef.current?.sendSignal(request.fromDeviceId, "connect_response", {
      accepted: false,
    });
  };

  // Disconnect from a peer
  const disconnectPeer = (peerId: string) => {
    webrtcManagerRef.current?.disconnectPeer(peerId, true);
    signalingClientRef.current?.sendSignal(peerId, "disconnect", {});

    setPeers((prev) => {
      const next = new Map<string, ConnectedPeer>(prev);
      next.delete(peerId);
      return next;
    });

    if (activePeerId === peerId) {
      setActivePeerId(null);
    }
  };

  // Send a private text message to active peer
  const sendMessage = (peerId: string, text: string): boolean => {
    if (!messagingServiceRef.current) return false;

    try {
      const msg = messagingServiceRef.current.sendMessage(peerId, text);
      setChatHistories((prev) => {
        const next = new Map<string, ChatMessage[]>(prev);
        const list = next.get(peerId) || [];
        next.set(peerId, [...list, msg]);
        return next;
      });

      setPeers((prev) => {
        const next = new Map<string, ConnectedPeer>(prev);
        const peer = next.get(peerId);
        if (peer) {
          next.set(peerId, { ...peer, lastMessage: msg, lastSeen: Date.now() });
        }
        return next;
      });

      return true;
    } catch (err) {
      console.error("Failed to send message:", err);
      return false;
    }
  };

  // Set typing indicator
  const sendTypingIndicator = (peerId: string, isTyping: boolean) => {
    messagingServiceRef.current?.sendTyping(peerId, isTyping);
  };

  // Mark unread messages as read when opening chat
  const openChatWithPeer = (peerId: string) => {
    setActivePeerId(peerId);
    setPeers((prev) => {
      const next = new Map<string, ConnectedPeer>(prev);
      const peer = next.get(peerId);
      if (peer && peer.unreadCount > 0) {
        next.set(peerId, { ...peer, unreadCount: 0 });
      }
      return next;
    });

    // Send read receipts for unread messages
    const history = chatHistories.get(peerId) || [];
    const unread = history.filter((m) => !m.isMine && m.status !== "read");
    unread.forEach((m) => {
      messagingServiceRef.current?.sendReadAck(peerId, m.id);
    });
  };

  const peersList = useMemo(() => Array.from(peers.values()), [peers]);
  const activePeer = useMemo(() => (activePeerId ? peers.get(activePeerId) || null : null), [peers, activePeerId]);
  const activeChatMessages = useMemo(
    () => (activePeerId ? chatHistories.get(activePeerId) || [] : []),
    [chatHistories, activePeerId]
  );
  const isTargetTyping = useMemo(
    () => (activePeerId ? !!typingPeers.get(activePeerId) : false),
    [typingPeers, activePeerId]
  );

  return {
    deviceInfo,
    connectionCode,
    isSignalingReady,
    signalingError,
    peersList,
    activePeerId,
    activePeer,
    activeChatMessages,
    isTargetTyping,
    incomingRequests,
    soundEnabled,
    setSoundEnabled,
    updateDeviceName,
    regenerateCode,
    connectByCode,
    acceptConnectionRequest,
    rejectConnectionRequest,
    disconnectPeer,
    sendMessage,
    sendTypingIndicator,
    openChatWithPeer,
    setActivePeerId,
  };
}
