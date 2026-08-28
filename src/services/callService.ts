import { ActiveCallState, CallStatus, DataPacket, DeviceType } from "../types";
import {
  playCallConnectedSound,
  playCallEndedSound,
  startIncomingCallRingtone,
  startOutgoingRingback,
  stopCallAudio,
} from "./sound";

export interface CallServiceCallbacks {
  onCallStateChange: (state: ActiveCallState | null) => void;
  sendPacket: (peerId: string, packet: DataPacket) => boolean;
  sendSignal?: (toDeviceId: string, type: any, data: any) => void;
}

export class VoiceCallService {
  private myDeviceId: string;
  private myDeviceName: string;
  private callbacks: CallServiceCallbacks;

  private activeCall: ActiveCallState | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private callPeerConnection: RTCPeerConnection | null = null;
  private durationInterval: any = null;
  private audioElement: HTMLAudioElement | null = null;

  constructor(myDeviceId: string, myDeviceName: string, callbacks: CallServiceCallbacks) {
    this.myDeviceId = myDeviceId;
    this.myDeviceName = myDeviceName;
    this.callbacks = callbacks;
    this.initAudioElement();
  }

  private initAudioElement() {
    if (typeof window !== "undefined") {
      this.audioElement = new Audio();
      this.audioElement.autoplay = true;
      (this.audioElement as any).playsInline = true;
    }
  }

  public getActiveCall(): ActiveCallState | null {
    return this.activeCall;
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  // 1. Start an outgoing call
  public async startCall(peerId: string, peerName: string, peerDeviceType?: DeviceType): Promise<boolean> {
    if (this.activeCall && this.activeCall.status !== "idle" && this.activeCall.status !== "ended") {
      return false; // Already in a call
    }

    try {
      // 1. Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      this.localStream = stream;

      const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      this.activeCall = {
        callId,
        peerId,
        peerName,
        peerDeviceType,
        status: "outgoing_calling",
        isCaller: true,
        duration: 0,
        isMuted: false,
      };
      this.callbacks.onCallStateChange(this.activeCall);

      // Play outgoing ringback tone
      startOutgoingRingback();

      // Create Call RTCPeerConnection
      await this.setupCallPeerConnection(peerId, true);

      // Send call request packet to peer
      this.callbacks.sendPacket(peerId, {
        id: `call_req_${Date.now()}`,
        type: "call_request",
        timestamp: Date.now(),
        senderId: this.myDeviceId,
        senderName: this.myDeviceName,
        payload: {
          callId,
          callerName: this.myDeviceName,
        },
      });

      return true;
    } catch (err) {
      console.error("Failed to start voice call (mic access or WebRTC error):", err);
      stopCallAudio();
      this.cleanupCall();
      alert("Microphone permission is required to make a voice call.");
      return false;
    }
  }

  // 2. Incoming call received
  public handleIncomingCallRequest(peerId: string, callerName: string, callId: string, peerDeviceType?: DeviceType) {
    if (this.activeCall && this.activeCall.status !== "idle" && this.activeCall.status !== "ended") {
      // Busy: Auto-reject with busy message
      this.callbacks.sendPacket(peerId, {
        id: `call_rej_${Date.now()}`,
        type: "call_reject",
        timestamp: Date.now(),
        senderId: this.myDeviceId,
        senderName: this.myDeviceName,
        payload: { callId, reason: "busy" },
      });
      return;
    }

    this.activeCall = {
      callId,
      peerId,
      peerName: callerName,
      peerDeviceType,
      status: "incoming_ringing",
      isCaller: false,
      duration: 0,
      isMuted: false,
    };
    this.callbacks.onCallStateChange(this.activeCall);

    // Play incoming call ringtone
    startIncomingCallRingtone();
  }

  // 3. Accept incoming call
  public async acceptCall(): Promise<boolean> {
    if (!this.activeCall || this.activeCall.status !== "incoming_ringing") return false;

    stopCallAudio();

    try {
      // Acquire microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      this.localStream = stream;

      const peerId = this.activeCall.peerId;
      const callId = this.activeCall.callId;

      await this.setupCallPeerConnection(peerId, false);

      // Notify caller that we accepted
      this.callbacks.sendPacket(peerId, {
        id: `call_acc_${Date.now()}`,
        type: "call_accept",
        timestamp: Date.now(),
        senderId: this.myDeviceId,
        senderName: this.myDeviceName,
        payload: { callId },
      });

      this.setCallConnected();
      return true;
    } catch (err) {
      console.error("Failed to accept voice call:", err);
      this.rejectCall();
      alert("Microphone permission is required to answer the voice call.");
      return false;
    }
  }

  // 4. Reject incoming call
  public rejectCall() {
    if (!this.activeCall) return;
    const peerId = this.activeCall.peerId;
    const callId = this.activeCall.callId;

    stopCallAudio();
    playCallEndedSound();

    this.callbacks.sendPacket(peerId, {
      id: `call_rej_${Date.now()}`,
      type: "call_reject",
      timestamp: Date.now(),
      senderId: this.myDeviceId,
      senderName: this.myDeviceName,
      payload: { callId, reason: "declined" },
    });

    this.cleanupCall();
  }

  // 5. End active call or cancel outgoing call
  public endCall() {
    if (!this.activeCall) return;
    const peerId = this.activeCall.peerId;
    const callId = this.activeCall.callId;

    stopCallAudio();
    playCallEndedSound();

    this.callbacks.sendPacket(peerId, {
      id: `call_end_${Date.now()}`,
      type: "call_end",
      timestamp: Date.now(),
      senderId: this.myDeviceId,
      senderName: this.myDeviceName,
      payload: { callId },
    });

    this.cleanupCall();
  }

  // 6. Handle remote response packets
  public handleCallPacket(packet: DataPacket) {
    switch (packet.type) {
      case "call_request":
        this.handleIncomingCallRequest(
          packet.senderId,
          packet.senderName,
          packet.payload.callId,
          packet.payload.peerDeviceType
        );
        break;

      case "call_accept":
        if (this.activeCall && this.activeCall.status === "outgoing_calling") {
          this.setCallConnected();
        }
        break;

      case "call_reject":
        if (this.activeCall) {
          stopCallAudio();
          playCallEndedSound();
          this.cleanupCall();
        }
        break;

      case "call_end":
        if (this.activeCall) {
          stopCallAudio();
          playCallEndedSound();
          this.cleanupCall();
        }
        break;

      case "call_mute_toggle":
        if (this.activeCall) {
          this.activeCall = {
            ...this.activeCall,
            isRemoteMuted: !!packet.payload.isMuted,
          };
          this.callbacks.onCallStateChange(this.activeCall);
        }
        break;
    }
  }

  // Toggle local microphone mute
  public toggleMute(): boolean {
    if (!this.localStream || !this.activeCall) return false;

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      const isMuted = !audioTrack.enabled;
      this.activeCall = {
        ...this.activeCall,
        isMuted,
      };
      this.callbacks.onCallStateChange(this.activeCall);

      // Notify peer of mute state
      this.callbacks.sendPacket(this.activeCall.peerId, {
        id: `call_mute_${Date.now()}`,
        type: "call_mute_toggle",
        timestamp: Date.now(),
        senderId: this.myDeviceId,
        senderName: this.myDeviceName,
        payload: { isMuted },
      });

      return isMuted;
    }
    return false;
  }

  private setCallConnected() {
    stopCallAudio();
    playCallConnectedSound();

    this.activeCall = {
      ...this.activeCall!,
      status: "connected",
      startTime: Date.now(),
      duration: 0,
    };
    this.callbacks.onCallStateChange(this.activeCall);

    // Start timer counter
    if (this.durationInterval) clearInterval(this.durationInterval);
    this.durationInterval = setInterval(() => {
      if (this.activeCall && this.activeCall.status === "connected") {
        this.activeCall = {
          ...this.activeCall,
          duration: this.activeCall.duration + 1,
        };
        this.callbacks.onCallStateChange(this.activeCall);
      }
    }, 1000);
  }

  private async setupCallPeerConnection(peerId: string, isInitiator: boolean) {
    if (this.callPeerConnection) {
      this.callPeerConnection.close();
      this.callPeerConnection = null;
    }

    const stunPool = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
    ];

    const pc = new RTCPeerConnection({ iceServers: stunPool });
    this.callPeerConnection = pc;

    // Attach local audio track
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Remote audio track handler
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        if (this.audioElement) {
          this.audioElement.srcObject = event.streams[0];
          this.audioElement.play().catch(console.warn);
        }
      }
    };

    // Forward call ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && this.activeCall) {
        // Send candidate via dataChannel or signal
        if (this.callbacks.sendSignal) {
          this.callbacks.sendSignal(peerId, "ice-candidate", event.candidate.toJSON());
        }
      }
    };
  }

  public cleanupCall() {
    stopCallAudio();

    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.audioElement) {
      this.audioElement.srcObject = null;
    }

    this.remoteStream = null;

    if (this.callPeerConnection) {
      try {
        this.callPeerConnection.close();
      } catch {}
      this.callPeerConnection = null;
    }

    this.activeCall = null;
    this.callbacks.onCallStateChange(null);
  }
}
