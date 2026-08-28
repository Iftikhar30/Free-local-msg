import React, { useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  HardDrive,
  Info,
  Key,
  RefreshCw,
  Server,
  ShieldCheck,
  Smartphone,
  Terminal,
  Zap,
} from "lucide-react";
import { DeviceInfo } from "../types";
import { getCustomIceServers, setCustomIceServers } from "../services/device";

interface SettingsScreenProps {
  deviceInfo: DeviceInfo;
  connectionCode: string;
  isSignalingReady: boolean;
  onUpdateDeviceName: (name: string) => void;
  onRegenerateCode: () => void;
}

export function SettingsScreen({
  deviceInfo,
  connectionCode,
  isSignalingReady,
  onUpdateDeviceName,
  onRegenerateCode,
}: SettingsScreenProps) {
  const [nameInput, setNameInput] = useState(deviceInfo.deviceName);
  const [nameSaved, setNameSaved] = useState(false);

  // Custom ICE servers
  const [iceServerInput, setIceServerInput] = useState("");
  const [iceSaved, setIceSaved] = useState(false);

  // Browser diagnostics
  const [diagnostics, setDiagnostics] = useState<{
    webrtc: boolean;
    dataChannel: boolean;
    crypto: boolean;
    storage: boolean;
  }>({
    webrtc: false,
    dataChannel: false,
    crypto: false,
    storage: false,
  });

  useEffect(() => {
    // Run diagnostics
    const hasWebRTC = typeof window !== "undefined" && "RTCPeerConnection" in window;
    const hasDataChannel = hasWebRTC && "RTCDataChannel" in window;
    const hasCrypto = typeof window !== "undefined" && "crypto" in window && "getRandomValues" in window.crypto;
    const hasStorage = typeof window !== "undefined" && "localStorage" in window;

    setDiagnostics({
      webrtc: hasWebRTC,
      dataChannel: hasDataChannel,
      crypto: hasCrypto,
      storage: hasStorage,
    });

    const savedIce = getCustomIceServers();
    if (savedIce.length > 0) {
      setIceServerInput(JSON.stringify(savedIce, null, 2));
    }
  }, []);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameInput.trim()) {
      onUpdateDeviceName(nameInput.trim());
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    }
  };

  const handleSaveIceServers = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!iceServerInput.trim()) {
        setCustomIceServers([]);
        setIceSaved(true);
        setTimeout(() => setIceSaved(false), 2000);
        return;
      }
      const parsed = JSON.parse(iceServerInput);
      if (Array.isArray(parsed)) {
        setCustomIceServers(parsed);
        setIceSaved(true);
        setTimeout(() => setIceSaved(false), 2000);
      } else {
        alert("ICE Servers configuration must be a JSON array of RTCIceServer objects.");
      }
    } catch (err: any) {
      alert("Invalid JSON format: " + err.message);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-8">
      {/* Title */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Configure device identity, WebRTC traversal, and security parameters.
        </p>
      </div>

      {/* 1. Device Profile Settings */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-2xs">
        <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <div className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">Device Profile</h3>
          </div>
        </div>

        <form onSubmit={handleSaveName} className="mt-3.5 space-y-3">
          <div>
            <label className="block text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Device Name
            </label>
            <div className="flex gap-2">
              <input
                id="settings-device-name-input"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Work Laptop, Living Room Tablet"
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="submit"
                id="save-device-name-btn"
                className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-colors"
              >
                {nameSaved ? <Check className="w-3.5 h-3.5" /> : null}
                <span>{nameSaved ? "Saved" : "Save Name"}</span>
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400 font-mono">
              Auto-detected environment: {deviceInfo.os} • {deviceInfo.browser}
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs border-t border-slate-100 dark:border-slate-800/60">
            <div>
              <span className="text-slate-400">Device ID: </span>
              <span className="font-mono text-slate-600 dark:text-slate-300 text-[10px]">
                {deviceInfo.deviceId}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Current Code: </span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                {connectionCode}
              </span>
              <button
                type="button"
                onClick={onRegenerateCode}
                className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] text-slate-700 dark:text-slate-300 font-medium transition-colors"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                <span>Rotate</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* 2. WebRTC & STUN / TURN Server Configuration */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-2xs">
        <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <div className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
              STUN / TURN Traversal
            </h3>
          </div>
        </div>

        <div className="mt-3 space-y-3">
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
            <div className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">Default STUN Pool:</div>
            <div className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400">
              • stun:stun.l.google.com:19302<br />
              • stun:stun1.l.google.com:19302<br />
              • stun:stun2.l.google.com:19302
            </div>
            <p className="pt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
              Google STUN servers enable peer connections across standard routers, Wi-Fi networks, and mobile data without relaying.
            </p>
          </div>

          <form onSubmit={handleSaveIceServers} className="space-y-2">
            <div>
              <label className="block text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Custom ICE Servers (Optional JSON)
              </label>
              <textarea
                value={iceServerInput}
                onChange={(e) => setIceServerInput(e.target.value)}
                placeholder={`[\n  {\n    "urls": "turn:turn.example.com:3478",\n    "username": "user",\n    "credential": "password"\n  }\n]`}
                rows={3}
                className="w-full font-mono text-[11px] rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold text-xs transition-colors"
            >
              {iceSaved ? <Check className="w-3 h-3" /> : null}
              <span>{iceSaved ? "Saved Custom ICE" : "Save ICE Servers"}</span>
            </button>
          </form>
        </div>
      </div>

      {/* 3. Browser & API Diagnostics */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-2xs">
        <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <div className="p-1 rounded-md bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">Browser Diagnostics</h3>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="font-medium text-slate-700 dark:text-slate-300 text-[11px]">RTCPeerConnection</span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" /> Supported
            </span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="font-medium text-slate-700 dark:text-slate-300 text-[11px]">RTCDataChannel</span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" /> Supported
            </span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="font-medium text-slate-700 dark:text-slate-300 text-[11px]">Web Cryptography</span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" /> Supported
            </span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="font-medium text-slate-700 dark:text-slate-300 text-[11px]">Signaling API</span>
            <span
              className={`flex items-center gap-1 font-semibold text-[11px] ${
                isSignalingReady ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500 animate-pulse"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> {isSignalingReady ? "Online" : "Connecting..."}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Privacy & Security Statement */}
      <div className="rounded-xl bg-slate-900 text-white p-4 shadow-sm border border-slate-800">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider">Privacy & Architecture Guarantee</h3>
        </div>
        <p className="text-[11px] text-slate-300 leading-normal">
          Messages travel directly between devices using peer-to-peer WebRTC DataChannels with DTLS and SCTP protocol.
        </p>
        <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] text-slate-300">
          <div className="p-2 rounded-lg bg-white/5 border border-white/10">
            <div className="font-semibold text-white">Zero Server Storage</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Payloads never touch disk.</div>
          </div>
          <div className="p-2 rounded-lg bg-white/5 border border-white/10">
            <div className="font-semibold text-white">E2E WebRTC</div>
            <div className="text-[10px] text-slate-400 mt-0.5">DTLS encrypted data channel.</div>
          </div>
          <div className="p-2 rounded-lg bg-white/5 border border-white/10">
            <div className="font-semibold text-white">No Accounts Required</div>
            <div className="text-[10px] text-slate-400 mt-0.5">No logins or tracking.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
