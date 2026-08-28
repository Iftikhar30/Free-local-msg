import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActiveCallState,
  ChatMessage,
  ConnectedPeer,
  DeviceInfo,
  IncomingConnectionRequest,
  PeerConnectionStatus,
  SignalMessage,
} from "../types";
import { VoiceCallService } from "../services/callService";
import {
  detectDeviceEnvironment,
  getDeviceInfo,
  getOrCreateConnectionCode,
  getStoredKnownPeers,
  rotateConnectionCode,
  saveStoredKnownPeers,
  setStoredDeviceName,
} from "../services/device";
import { MessagingService } from "../services/messaging";
import { SignalingClient } from "../services/signaling";
import { WebRTCManager } from "../services/webrtc";
import {
  getStoredSoundPreference,
  playConnectionRequestSound,
  playMessageSound,
  setStoredSoundPreference,
} from "../services/sound";

export function useLocalLink() {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => getDeviceInfo());
  // Persistent 6-character code (survives page reloads)
  const [connectionCode, setConnectionCode] = useState<string>(() => getOrCreateConnectionCode());
  const [isSignalingReady, setIsSignalingReady] = useState(false);
  const [signalingError, setSignalingError] = useState<string | null>(null);

  // Connected & known peers list loaded from persistent storage
  const [peers, setPeers] = useState<Map<string, ConnectedPeer>>(() => {
    const initialMap = new Map<string, ConnectedPeer>();
    const stored = getStoredKnownPeers();
    stored.forEach((p) => initialMap.set(p.deviceId, p));
    return initialMap;
  });
  const [activePeerId, setActivePeerId] = useState<string | null>(null);

  // Messages map: peerId -> ChatMessage[]
  const [chatHistories, setChatHistories] = useState<Map<string, ChatMessage[]>>(new Map<string, ChatMessage[]>());

  // Typing status: peerId -> boolean
  const [typingPeers, setTypingPeers] = useState<Map<string, boolean>>(new Map<string, boolean>());

  // Incoming connection requests
  const [incomingRequests, setIncomingRequests] = useState<IncomingConnectionRequest[]>([]);

  // Active Voice Call state
  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);

  // Sound preference
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => getStoredSoundPreference());

  const setSoundEnabled = (enabled: boolean) => {
    setStoredSoundPreference(enabled);
    setSoundEnabledState(enabled);
  };

  // References to keep callbacks current without re-instantiating services
  const signalingClientRef = useRef<SignalingClient | null>(null);
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);
  const messagingServiceRef = useRef<MessagingService | null>(null);
  const voiceCallServiceRef = useRef<VoiceCallService | null>(null);

  // Save peers whenever the map changes
  useEffect(() => {
    saveStoredKnownPeers(Array.from(peers.values()));
  }, [peers]);

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
              status: state === "open" ? "connected" : state === "closed" ? "disconnected" : peer.status,
            });
          }
          return next;
        });
      },
      onPacketReceived: (peerId: string, packet: any) => {
        if (
          packet.type === "call_request" ||
          packet.type === "call_accept" ||
          packet.type === "call_reject" ||
          packet.type === "call_end" ||
          packet.type === "call_mute_toggle"
        ) {
          voiceCallServiceRef.current?.handleCallPacket(packet);
        } else {
          messagingServiceRef.current?.handleIncomingPacket(peerId, packet);
        }
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
        playMessageSound();

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
      onFileProgressUpdated: (peerId, fileId, progress, status, url) => {
        setChatHistories((prev) => {
          const next = new Map<string, ChatMessage[]>(prev);
          const list = next.get(peerId);
          if (list) {
            const updated = list.map((msg) => {
              if (msg.id === fileId || (msg.file && msg.file.id === fileId)) {
                const existingFile = msg.file || {
                  id: fileId,
                  name: "File",
                  size: 0,
                  mimeType: "application/octet-stream",
                  totalChunks: 1,
                  progress: 0,
                  status: "transferring" as const,
                };
                return {
                  ...msg,
                  file: {
                    ...existingFile,
                    progress,
                    status,
                    ...(url ? { url } : {}),
                  },
                };
              }
              return msg;
            });
            next.set(peerId, updated);
          }
          return next;
        });
      },
    });
    messagingServiceRef.current = messaging;

    // Initialize Voice Call Service
    const voiceCall = new VoiceCallService(deviceInfo.deviceId, deviceInfo.deviceName, {
      onCallStateChange: (state) => {
        setActiveCall(state);
      },
      sendPacket: (peerId, packet) => {
        return webrtc.sendDataPacket(peerId, packet);
      },
      sendSignal: (toDeviceId, type, data) => {
        signaling.sendSignal(toDeviceId, type, data);
      },
    });
    voiceCallServiceRef.current = voiceCall;

    // Register our persistent code on signaling server
    const registerDevice = async () => {
      const res = await signaling.register(connectionCode);
      if (res.success) {
        setIsSignalingReady(true);
        setSignalingError(null);
      } else {
        if (res.codeTaken) {
          const fresh = rotateConnectionCode();
          setConnectionCode(fresh);
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

    // Handle online/offline network reconnection
    const handleOnline = () => {
      signaling.register(connectionCode);
    };
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
      signaling.stop();
      webrtc.disconnectAll();
    };
  }, [connectionCode, deviceInfo.deviceId]);

  // Handle incoming signaling messages
  const handleIncomingSignal = async (signal: SignalMessage) => {
    switch (signal.type) {
      case "connect_request": {
        playConnectionRequestSound();
        setIncomingRequests((prev) => {
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
            const p = next.get(signal.fromDeviceId);
            if (p) {
              next.set(signal.fromDeviceId, { ...p, status: "failed" });
            }
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

  // Explicitly generate and rotate to a new Connection Code
  const regenerateCode = async () => {
    const newCode = rotateConnectionCode();
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

  // Reconnect an existing known peer
  const reconnectPeer = async (peerId: string): Promise<void> => {
    const peer = peers.get(peerId);
    if (!peer) return;

    setPeers((prev) => {
      const next = new Map<string, ConnectedPeer>(prev);
      const p = next.get(peerId);
      if (p) {
        next.set(peerId, { ...p, status: "reconnecting", dataChannelStatus: "connecting" });
      }
      return next;
    });

    if (peer.connectionCode) {
      // If we know their code, request connection again
      await connectByCode(peer.connectionCode);
    } else {
      // Try direct WebRTC re-initiation via signaling
      const env = detectDeviceEnvironment();
      await signalingClientRef.current?.sendSignal(peerId, "connect_request", {
        deviceType: env.deviceType,
        os: env.os,
      });
      await webrtcManagerRef.current?.reconnectPeer(peerId);
    }
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
      const p = next.get(peerId);
      if (p) {
        next.set(peerId, { ...p, status: "disconnected", dataChannelStatus: "closed" });
      }
      return next;
    });

    if (activePeerId === peerId) {
      setActivePeerId(null);
    }
  };

  // Remove known peer from saved list
  const removePeer = (peerId: string) => {
    disconnectPeer(peerId);
    setPeers((prev) => {
      const next = new Map<string, ConnectedPeer>(prev);
      next.delete(peerId);
      return next;
    });
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

  // Send a file to active peer
  const sendFile = async (peerId: string, file: File): Promise<ChatMessage | null> => {
    if (!messagingServiceRef.current) return null;

    try {
      const msg = await messagingServiceRef.current.sendFile(peerId, file);
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

      return msg;
    } catch (err) {
      console.error("Failed to send file:", err);
      return null;
    }
  };

  // Send a voice message to active peer
  const sendVoiceMessage = async (
    peerId: string,
    audioBlob: Blob,
    duration: number,
    waveformData?: number[]
  ): Promise<ChatMessage | null> => {
    if (!messagingServiceRef.current) return null;

    try {
      const msg = await messagingServiceRef.current.sendVoiceMessage(
        peerId,
        audioBlob,
        duration,
        waveformData
      );
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

      return msg;
    } catch (err) {
      console.error("Failed to send voice message:", err);
      return null;
    }
  };

  // Start outgoing voice call
  const startVoiceCall = async (peerId: string): Promise<boolean> => {
    const peer = peers.get(peerId);
    if (!peer || !voiceCallServiceRef.current) return false;
    return await voiceCallServiceRef.current.startCall(peerId, peer.deviceName, peer.deviceType);
  };

  // Accept incoming voice call
  const acceptVoiceCall = async (): Promise<boolean> => {
    if (!voiceCallServiceRef.current) return false;
    return await voiceCallServiceRef.current.acceptCall();
  };

  // Reject incoming voice call
  const rejectVoiceCall = () => {
    voiceCallServiceRef.current?.rejectCall();
  };

  // End active or outgoing call
  const endVoiceCall = () => {
    voiceCallServiceRef.current?.endCall();
  };

  // Toggle local mic mute
  const toggleVoiceCallMute = () => {
    voiceCallServiceRef.current?.toggleMute();
  };

  // Cancel ongoing file transfer
  const cancelFileTransfer = (peerId: string, fileId: string) => {
    messagingServiceRef.current?.cancelFileTransfer(peerId, fileId);
    setChatHistories((prev) => {
      const next = new Map<string, ChatMessage[]>(prev);
      const list = next.get(peerId);
      if (list) {
        const updated = list.map((msg) => {
          if (msg.id === fileId || (msg.file && msg.file.id === fileId)) {
            return {
              ...msg,
              file: msg.file ? { ...msg.file, status: "cancelled" as const } : undefined,
            };
          }
          return msg;
        });
        next.set(peerId, updated);
      }
      return next;
    });
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
    activeCall,
    soundEnabled,
    setSoundEnabled,
    updateDeviceName,
    regenerateCode,
    connectByCode,
    reconnectPeer,
    removePeer,
    acceptConnectionRequest,
    rejectConnectionRequest,
    disconnectPeer,
    sendMessage,
    sendFile,
    sendVoiceMessage,
    startVoiceCall,
    acceptVoiceCall,
    rejectVoiceCall,
    endVoiceCall,
    toggleVoiceCallMute,
    cancelFileTransfer,
    sendTypingIndicator,
    openChatWithPeer,
    setActivePeerId,
  };

}
