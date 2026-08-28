import { ActiveCallState, CallStatus, DataPacket, DeviceType } from "../types";
import { detectDeviceEnvironment, getCustomIceServers } from "./device";
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
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;

  private pendingRemoteOffer: RTCSessionDescriptionInit | null = null;
  private pendingRemoteIceCandidates: RTCIceCandidateInit[] = [];

  constructor(myDeviceId: string, myDeviceName: string, callbacks: CallServiceCallbacks) {
    this.myDeviceId = myDeviceId;
    this.myDeviceName = myDeviceName;
    this.callbacks = callbacks;
    this.initAudioElement();
  }

  private initAudioElement() {
    if (typeof window !== "undefined") {
      let el = document.getElementById("locallink-call-audio-stream") as HTMLAudioElement;
      if (!el) {
        el = document.createElement("audio");
        el.id = "locallink-call-audio-stream";
        el.autoplay = true;
        (el as any).playsInline = true;
        el.style.display = "none";
        document.body.appendChild(el);
      }
      this.audioElement = el;
    }
  }

  private getRtcConfiguration(): RTCConfiguration {
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
    const stunUrls =
      envStun && typeof envStun === "string" && envStun.trim()
        ? envStun.split(",").map((s: string) => s.trim()).filter(Boolean)
        : defaultStunPool;

    const iceServers: RTCIceServer[] = stunUrls.map((url: string) => ({ urls: url }));

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
      return false;
    }

    this.cleanupCall();

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

      // Create WebRTC PeerConnection for Voice Call
      const pc = new RTCPeerConnection(this.getRtcConfiguration());
      this.callPeerConnection = pc;

      // Add local audio tracks to peer connection
      stream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Handle remote incoming audio stream
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0];
          this.attachRemoteAudio(event.streams[0]);
        }
      };

      // Handle ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && this.activeCall) {
          this.callbacks.sendPacket(peerId, {
            id: `call_ice_${Date.now()}`,
            type: "call_ice_candidate",
            timestamp: Date.now(),
            senderId: this.myDeviceId,
            senderName: this.myDeviceName,
            payload: {
              callId,
              candidate: event.candidate.toJSON(),
            },
          });
        }
      };

      // Create and set local SDP Offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
      });
      await pc.setLocalDescription(offer);

      // Send call request packet to peer with SDP Offer
      const sent = this.callbacks.sendPacket(peerId, {
        id: `call_req_${Date.now()}`,
        type: "call_request",
        timestamp: Date.now(),
        senderId: this.myDeviceId,
        senderName: this.myDeviceName,
        payload: {
          callId,
          callerName: this.myDeviceName,
          peerDeviceType: detectDeviceEnvironment().deviceType,
          offer: pc.localDescription?.toJSON() || offer,
        },
      });

      if (!sent) {
        console.warn("Failed to send call_request packet over DataChannel, falling back to signaling");
        this.callbacks.sendSignal?.(peerId, "offer", {
          callId,
          callerName: this.myDeviceName,
          offer: pc.localDescription?.toJSON() || offer,
        });
      }

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
  public handleIncomingCallRequest(
    peerId: string,
    callerName: string,
    callId: string,
    offer?: RTCSessionDescriptionInit,
    peerDeviceType?: DeviceType
  ) {
    if (this.activeCall && this.activeCall.status !== "idle" && this.activeCall.status !== "ended") {
      // Busy: Auto-reject with busy reason
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

    this.pendingRemoteOffer = offer || null;
    this.pendingRemoteIceCandidates = [];

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

      // Create WebRTC PeerConnection for Voice Call
      const pc = new RTCPeerConnection(this.getRtcConfiguration());
      this.callPeerConnection = pc;

      // Add local audio track
      stream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Handle remote incoming audio stream
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0];
          this.attachRemoteAudio(event.streams[0]);
        }
      };

      // Handle ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && this.activeCall) {
          this.callbacks.sendPacket(peerId, {
            id: `call_ice_${Date.now()}`,
            type: "call_ice_candidate",
            timestamp: Date.now(),
            senderId: this.myDeviceId,
            senderName: this.myDeviceName,
            payload: {
              callId,
              candidate: event.candidate.toJSON(),
            },
          });
        }
      };

      // Set Remote Description (Caller's SDP Offer)
      if (this.pendingRemoteOffer) {
        await pc.setRemoteDescription(new RTCSessionDescription(this.pendingRemoteOffer));
        this.pendingRemoteOffer = null;
      }

      // Flush any queued ICE candidates received prior to answering
      while (this.pendingRemoteIceCandidates.length > 0) {
        const cand = this.pendingRemoteIceCandidates.shift();
        if (cand) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch (e) {
            console.warn("Failed to add buffered candidate:", e);
          }
        }
      }

      // Create and set local SDP Answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Notify caller with SDP Answer
      this.callbacks.sendPacket(peerId, {
        id: `call_acc_${Date.now()}`,
        type: "call_accept",
        timestamp: Date.now(),
        senderId: this.myDeviceId,
        senderName: this.myDeviceName,
        payload: {
          callId,
          answer: pc.localDescription?.toJSON() || answer,
        },
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
  public async handleCallPacket(packet: DataPacket) {
    switch (packet.type) {
      case "call_request":
        this.handleIncomingCallRequest(
          packet.senderId,
          packet.payload.callerName || packet.senderName,
          packet.payload.callId,
          packet.payload.offer,
          packet.payload.peerDeviceType
        );
        break;

      case "call_accept":
        if (this.activeCall && this.activeCall.status === "outgoing_calling") {
          const answer = packet.payload.answer;
          if (this.callPeerConnection && answer) {
            try {
              await this.callPeerConnection.setRemoteDescription(new RTCSessionDescription(answer));

              // Flush buffered candidates
              while (this.pendingRemoteIceCandidates.length > 0) {
                const cand = this.pendingRemoteIceCandidates.shift();
                if (cand) {
                  try {
                    await this.callPeerConnection.addIceCandidate(new RTCIceCandidate(cand));
                  } catch (e) {
                    console.warn("Failed to add buffered candidate on answer:", e);
                  }
                }
              }
            } catch (err) {
              console.error("Failed to set remote description on call_accept:", err);
            }
          }
          this.setCallConnected();
        }
        break;

      case "call_ice_candidate":
        if (packet.payload?.candidate) {
          if (
            this.callPeerConnection &&
            this.callPeerConnection.remoteDescription &&
            this.callPeerConnection.remoteDescription.type
          ) {
            try {
              await this.callPeerConnection.addIceCandidate(new RTCIceCandidate(packet.payload.candidate));
            } catch (err) {
              console.warn("Failed to add received ICE candidate:", err);
            }
          } else {
            this.pendingRemoteIceCandidates.push(packet.payload.candidate);
          }
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

  // Toggle Loudspeaker / Speakerphone mode
  public async toggleSpeaker(): Promise<boolean> {
    if (!this.activeCall) return false;

    const nextSpeakerState = !this.activeCall.isSpeakerOn;
    this.activeCall = {
      ...this.activeCall,
      isSpeakerOn: nextSpeakerState,
    };
    this.callbacks.onCallStateChange(this.activeCall);

    // 1. Adjust Web Audio gain amplification
    if (this.gainNode && this.audioContext) {
      const targetGain = nextSpeakerState ? 2.5 : 1.0;
      try {
        this.gainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
        this.gainNode.gain.linearRampToValueAtTime(targetGain, this.audioContext.currentTime + 0.1);
      } catch {
        this.gainNode.gain.value = targetGain;
      }
    }

    // 2. Hardware speaker device selection via setSinkId if supported by browser
    if (this.audioElement && typeof (this.audioElement as any).setSinkId === "function") {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter((d) => d.kind === "audiooutput");

        if (nextSpeakerState) {
          // Look for speaker device
          const speaker = audioOutputs.find(
            (d) =>
              d.label.toLowerCase().includes("speaker") ||
              d.label.toLowerCase().includes("lautsprecher") ||
              d.label.toLowerCase().includes("haut-parleur") ||
              d.deviceId === "default"
          );
          if (speaker && speaker.deviceId) {
            await (this.audioElement as any).setSinkId(speaker.deviceId);
          }
        } else {
          // Look for communications / earpiece / default device
          const receiver = audioOutputs.find(
            (d) =>
              d.label.toLowerCase().includes("earpiece") ||
              d.label.toLowerCase().includes("receiver") ||
              d.label.toLowerCase().includes("headset") ||
              d.label.toLowerCase().includes("headphones")
          );
          if (receiver && receiver.deviceId) {
            await (this.audioElement as any).setSinkId(receiver.deviceId);
          } else if (audioOutputs.length > 0) {
            await (this.audioElement as any).setSinkId("");
          }
        }
      } catch (err) {
        console.warn("setSinkId speaker route error:", err);
      }
    }

    return nextSpeakerState;
  }

  private attachRemoteAudio(stream: MediaStream) {
    if (typeof window === "undefined") return;

    if (!this.audioElement) {
      this.initAudioElement();
    }

    // Connect stream to audio element
    if (this.audioElement) {
      this.audioElement.srcObject = stream;
      const playPromise = this.audioElement.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("Auto-play was prevented by browser policy, unlocking on next touch:", err);
          const unlock = () => {
            this.audioElement?.play().catch(console.warn);
            window.removeEventListener("click", unlock);
            window.removeEventListener("touchstart", unlock);
          };
          window.addEventListener("click", unlock, { once: true });
          window.addEventListener("touchstart", unlock, { once: true });
        });
      }
    }

    // Connect Web Audio API graph for rich dynamic amplification and loudspeaker gain boost
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        if (!this.audioContext || this.audioContext.state === "closed") {
          this.audioContext = new AudioCtx();
        }
        if (this.audioContext.state === "suspended") {
          this.audioContext.resume().catch(() => {});
        }

        if (this.sourceNode) {
          try {
            this.sourceNode.disconnect();
          } catch {}
        }

        this.sourceNode = this.audioContext.createMediaStreamSource(stream);
        this.gainNode = this.audioContext.createGain();
        this.compressorNode = this.audioContext.createDynamicsCompressor();

        // Dynamics compressor settings to prevent harsh clipping when loudspeaker gain is boosted
        this.compressorNode.threshold.setValueAtTime(-18, this.audioContext.currentTime);
        this.compressorNode.knee.setValueAtTime(12, this.audioContext.currentTime);
        this.compressorNode.ratio.setValueAtTime(4, this.audioContext.currentTime);
        this.compressorNode.attack.setValueAtTime(0.003, this.audioContext.currentTime);
        this.compressorNode.release.setValueAtTime(0.25, this.audioContext.currentTime);

        const initialGain = this.activeCall?.isSpeakerOn ? 2.5 : 1.0;
        this.gainNode.gain.setValueAtTime(initialGain, this.audioContext.currentTime);

        this.sourceNode.connect(this.compressorNode);
        this.compressorNode.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);
      }
    } catch (e) {
      console.warn("Web Audio Routing init non-critical error:", e);
    }
  }

  private setCallConnected() {
    stopCallAudio();
    playCallConnectedSound();

    if (!this.activeCall) return;

    this.activeCall = {
      ...this.activeCall,
      status: "connected",
      startTime: Date.now(),
      duration: 0,
    };
    this.callbacks.onCallStateChange(this.activeCall);

    // Start duration timer counter
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
      try {
        this.audioElement.pause();
        this.audioElement.srcObject = null;
      } catch {}
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }

    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch {}
      this.gainNode = null;
    }

    if (this.compressorNode) {
      try {
        this.compressorNode.disconnect();
      } catch {}
      this.compressorNode = null;
    }

    this.remoteStream = null;
    this.pendingRemoteOffer = null;
    this.pendingRemoteIceCandidates = [];

    if (this.callPeerConnection) {
      try {
        this.callPeerConnection.ontrack = null;
        this.callPeerConnection.onicecandidate = null;
        this.callPeerConnection.close();
      } catch {}
      this.callPeerConnection = null;
    }

    this.activeCall = null;
    this.callbacks.onCallStateChange(null);
  }
}
