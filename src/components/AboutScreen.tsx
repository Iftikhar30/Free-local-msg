import { useEffect, useState } from "react";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Cpu,
  Globe,
  Info,
  Key,
  Layers,
  Lock,
  MessageSquare,
  Radio,
  Server,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wifi,
  XCircle,
  Zap,
} from "lucide-react";
import { ConnectedPeer, DeviceInfo } from "../types";

interface AboutScreenProps {
  deviceInfo: DeviceInfo;
  isSignalingReady: boolean;
  peers: ConnectedPeer[];
}

export function AboutScreen({
  deviceInfo,
  isSignalingReady,
  peers,
}: AboutScreenProps) {
  const [diagnostics, setDiagnostics] = useState<{
    webrtc: boolean;
    dataChannel: boolean;
    crypto: boolean;
    camera: boolean;
    storage: boolean;
  }>({
    webrtc: false,
    dataChannel: false,
    crypto: false,
    camera: false,
    storage: false,
  });

  useEffect(() => {
    const hasWebRTC = typeof window !== "undefined" && "RTCPeerConnection" in window;
    const hasDataChannel = hasWebRTC && "RTCDataChannel" in window;
    const hasCrypto = typeof window !== "undefined" && "crypto" in window && "getRandomValues" in window.crypto;
    const hasStorage = typeof window !== "undefined" && "localStorage" in window;
    const hasCamera = typeof navigator !== "undefined" && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia;

    setDiagnostics({
      webrtc: hasWebRTC,
      dataChannel: hasDataChannel,
      crypto: hasCrypto,
      camera: hasCamera,
      storage: hasStorage,
    });
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* 1. Header */}
      <div className="text-center pt-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900/80 text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-2 shadow-2xs">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Built with Google AI Studio</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          About LocalLink
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
          Private device-to-device communication, made simple.
        </p>
      </div>

      {/* 2. Highlight Privacy & Trust Statement Card */}
      <div className="rounded-2xl bg-gradient-to-b from-indigo-900 to-slate-900 text-white p-6 shadow-md border border-indigo-800/80">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-300">
              TRUST & PRIVACY PRINCIPLES
            </span>
            <h2 className="text-base font-bold text-white">
              Built with Google AI Studio
            </h2>
          </div>
        </div>

        <p className="text-xs text-indigo-100/90 leading-relaxed">
          LocalLink is a lightweight peer-to-peer communication application built with Google AI Studio. It does not require an account, login, or unnecessary device permissions. Your conversations are designed to stay between your connected devices through peer-to-peer WebRTC communication whenever a direct connection is possible. LocalLink does not intentionally store your private message content on a central database.
        </p>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-4 border-t border-indigo-800/60">
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white mb-1">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Your Privacy Matters</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-normal">
              LocalLink is designed with privacy in mind. You do not need to create an account or provide personal information to start using the app. Messages are exchanged directly between connected devices whenever WebRTC can establish a peer-to-peer connection.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white mb-1">
              <Radio className="w-3.5 h-3.5 text-sky-400" />
              <span>Connection Note</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-normal">
              LocalLink uses a signaling service only to help devices discover each other and establish a WebRTC connection. Depending on the network configuration, WebRTC may use a relay (TURN) server when a direct peer-to-peer connection cannot be established.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white mb-1">
              <Wifi className="w-3.5 h-3.5 text-indigo-400" />
              <span>Local Network Friendly</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-normal">
              LocalLink is optimized for direct device-to-device communication. When devices are on the same local network, WebRTC can often establish a direct connection. Devices on different networks may also connect when WebRTC NAT traversal succeeds.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Visual Connection Architecture Flow */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white">
              How LocalLink Works
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Four-step peer-to-peer lifecycle
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center justify-between">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-mono text-[10px] font-bold flex items-center justify-center">
                1
              </span>
              <Key className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <h4 className="mt-2 text-xs font-bold text-slate-900 dark:text-white">
              Device Pairing Code
            </h4>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
              Each device gets a unique 6-character code that persists across browser reloads.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center justify-between">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-mono text-[10px] font-bold flex items-center justify-center">
                2
              </span>
              <Radio className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <h4 className="mt-2 text-xs font-bold text-slate-900 dark:text-white">
              Signaling Discovery
            </h4>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
              Temporary handshake exchanges SDP offer/answer without ever touching message data.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center justify-between">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-mono text-[10px] font-bold flex items-center justify-center">
                3
              </span>
              <Lock className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <h4 className="mt-2 text-xs font-bold text-slate-900 dark:text-white">
              WebRTC DataChannel
            </h4>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
              An encrypted direct P2P tunnel (DTLS + SCTP) binds both browsers directly.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center justify-between">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-mono text-[10px] font-bold flex items-center justify-center">
                4
              </span>
              <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <h4 className="mt-2 text-xs font-bold text-slate-900 dark:text-white">
              Direct Messaging
            </h4>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
              Messages stream directly with delivery acknowledgements and low latency.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Live Technical Diagnostics */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white">
                Live Technical Diagnostics
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                Environment & API availability
              </p>
            </div>
          </div>
          <div className="text-[10px] font-mono text-slate-400">
            {deviceInfo.os} • {deviceInfo.browser}
          </div>
        </div>

        <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-700 dark:text-slate-300 font-medium">RTCPeerConnection</span>
            {diagnostics.webrtc ? (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5" /> Supported
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold text-rose-500 text-[11px]">
                <XCircle className="w-3.5 h-3.5" /> Unsupported
              </span>
            )}
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-700 dark:text-slate-300 font-medium">RTCDataChannel</span>
            {diagnostics.dataChannel ? (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5" /> Supported
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold text-rose-500 text-[11px]">
                <XCircle className="w-3.5 h-3.5" /> Unsupported
              </span>
            )}
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-700 dark:text-slate-300 font-medium">Web Crypto API</span>
            {diagnostics.crypto ? (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5" /> Supported
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold text-rose-500 text-[11px]">
                <XCircle className="w-3.5 h-3.5" /> Unsupported
              </span>
            )}
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-700 dark:text-slate-300 font-medium">Camera QR Scanner</span>
            {diagnostics.camera ? (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5" /> Available
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold text-amber-500 text-[11px]">
                <Info className="w-3.5 h-3.5" /> Unavailable
              </span>
            )}
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-700 dark:text-slate-300 font-medium">Signaling Service</span>
            <span
              className={`inline-flex items-center gap-1 font-semibold text-[11px] ${
                isSignalingReady
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-500 animate-pulse"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isSignalingReady ? "Online" : "Connecting..."}
            </span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-700 dark:text-slate-300 font-medium">Active Peers</span>
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-[11px]">
              {peers.filter((p) => p.status === "connected").length} / {peers.length}
            </span>
          </div>
        </div>
      </div>

      {/* 5. Network & NAT Traversal Information */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white">
              STUN Traversal & Network Limitations
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              NAT traversal transparency
            </p>
          </div>
        </div>

        <div className="mt-3.5 space-y-2.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          <p>
            LocalLink is configured with standard Google public STUN servers to negotiate peer-to-peer connections across common home routers, Wi-Fi networks, and standard cellular data without routing payload data through any third-party server.
          </p>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-1">
            <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
              When might a connection fail?
            </div>
            <ul className="list-disc list-inside text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
              <li>Both devices are behind restrictive symmetric NATs or corporate enterprise firewalls (requires custom TURN in Settings).</li>
              <li>Mobile operating systems putting browser tabs to sleep in the background.</li>
              <li>Unstable Wi-Fi/cellular handoffs.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
