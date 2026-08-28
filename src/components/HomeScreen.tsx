import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  Bell,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  Edit2,
  Info,
  Laptop,
  MessageSquare,
  QrCode,
  Radio,
  RefreshCw,
  Smartphone,
  Wifi,
  X,
} from "lucide-react";
import { ConnectedPeer, DeviceInfo, IncomingConnectionRequest } from "../types";
import { PushNotificationService } from "../services/pushNotification";

interface HomeScreenProps {
  deviceInfo: DeviceInfo;
  connectionCode: string;
  isSignalingReady: boolean;
  signalingError: string | null;
  peers: ConnectedPeer[];
  incomingRequests: IncomingConnectionRequest[];
  onOpenConnectModal: () => void;
  onOpenQrModal: () => void;
  onOpenRegenerateModal: () => void;
  onUpdateDeviceName: (name: string) => void;
  onQuickConnect: (code: string) => Promise<{ success: boolean; error?: string }>;
  onAcceptRequest: (requestId: string) => void;
  onRejectRequest: (requestId: string) => void;
  onOpenChat: (peerId: string) => void;
  onNavigateToDevices: () => void;
}

export function HomeScreen({
  deviceInfo,
  connectionCode,
  isSignalingReady,
  signalingError,
  peers,
  incomingRequests,
  onOpenConnectModal,
  onOpenQrModal,
  onOpenRegenerateModal,
  onUpdateDeviceName,
  onQuickConnect,
  onAcceptRequest,
  onRejectRequest,
  onOpenChat,
  onNavigateToDevices,
}: HomeScreenProps) {
  const [quickCode, setQuickCode] = useState("");
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameInput, setEditNameInput] = useState(deviceInfo.deviceName);

  // Push Notification Prompt
  const [showPushBanner, setShowPushBanner] = useState(false);
  const [pushEnabling, setPushEnabling] = useState(false);
  const [pushSuccess, setPushSuccess] = useState(false);

  useEffect(() => {
    // Only check and show banner if supported and not dismissed
    if (PushNotificationService.isSupported()) {
      PushNotificationService.getStatus().then((status) => {
        const isDismissed = localStorage.getItem("locallink_push_banner_dismissed");
        if (!status.isSubscribed && status.permission !== "denied" && !isDismissed) {
          setShowPushBanner(true);
        }
      });
    }
  }, []);

  const handleEnablePush = async () => {
    setPushEnabling(true);
    const res = await PushNotificationService.subscribe(deviceInfo.deviceId, deviceInfo.deviceName);
    setPushEnabling(false);
    if (res.success) {
      setPushSuccess(true);
      setTimeout(() => setShowPushBanner(false), 3000);
    }
  };

  const handleDismissPush = () => {
    setShowPushBanner(false);
    localStorage.setItem("locallink_push_banner_dismissed", "true");
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(connectionCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleQuickConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = quickCode.trim().toUpperCase();
    if (!clean) return;

    setQuickLoading(true);
    setQuickError(null);

    const res = await onQuickConnect(clean);
    setQuickLoading(false);

    if (res.success) {
      setQuickCode("");
    } else {
      setQuickError(res.error || "Failed to initiate connection");
    }
  };

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (editNameInput.trim()) {
      onUpdateDeviceName(editNameInput.trim());
    }
    setIsEditingName(false);
  };

  const connectedPeers = peers.filter((p) => p.status === "connected");

  return (
    <div className="space-y-5 pb-8">
      {/* Hero Welcome Banner */}
      <div className="text-center max-w-2xl mx-auto pt-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Connect your devices{" "}
          <span className="text-indigo-600 dark:text-indigo-400">
            instantly.
          </span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
          Direct browser-to-browser messaging across local Wi-Fi or Internet.
        </p>
      </div>

      {/* Signaling Warning if offline */}
      {signalingError && (
        <div className="max-w-3xl mx-auto rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2.5">
          <Info className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1">
            <span className="font-semibold">Signaling Server:</span> {signalingError}.
          </div>
        </div>
      )}

      {/* Background Push Notification Prompt Banner */}
      {showPushBanner && (
        <div className="max-w-3xl mx-auto rounded-2xl bg-linear-to-r from-indigo-900 to-slate-900 border border-indigo-500/40 p-4 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 relative animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <span>Enable Background Notifications</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 font-normal">
                  Recommended
                </span>
              </h3>
              <p className="text-xs text-indigo-200/90 mt-0.5">
                Receive calls & messages even when this tab is closed or your phone screen is off.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            {pushSuccess ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Notifications Active!</span>
              </div>
            ) : (
              <button
                type="button"
                id="enable-push-banner-btn"
                disabled={pushEnabling}
                onClick={handleEnablePush}
                className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {pushEnabling ? "Activating..." : "Turn On Notifications"}
              </button>
            )}

            <button
              type="button"
              id="dismiss-push-banner-btn"
              onClick={handleDismissPush}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Incoming Connection Requests Banner */}
      {incomingRequests.length > 0 && (
        <div className="max-w-3xl mx-auto space-y-2.5">
          {incomingRequests.map((req) => (
            <div
              key={req.id}
              className="rounded-2xl border-2 border-indigo-500 bg-indigo-50/95 dark:bg-indigo-950/60 p-4 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 text-center sm:text-left">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Smartphone className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded font-mono text-[10px] font-bold bg-indigo-200/80 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 mb-0.5">
                    INCOMING REQUEST
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {req.fromDeviceName} wants to connect
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Accept to open direct peer-to-peer chat
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  id={`reject-home-req-${req.id}`}
                  onClick={() => onRejectRequest(req.id)}
                  className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Reject
                </button>
                <button
                  id={`accept-home-req-${req.id}`}
                  onClick={() => onAcceptRequest(req.id)}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all active:scale-98"
                >
                  Accept & Connect
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Grid: Your Device Code Card + Connect To Another Device Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
        {/* Card 1: Your Device Identity & Code */}
        <div
          id="your-device-code-card"
          className="relative rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-indigo-600 dark:text-indigo-400">
                YOUR DEVICE
              </span>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-900/60 text-[10px] font-mono font-medium text-emerald-700 dark:text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{isSignalingReady ? "ONLINE" : "CONNECTING"}</span>
              </div>
            </div>

            {/* Editable Device Name */}
            <div className="mt-3">
              {isEditingName ? (
                <form onSubmit={handleSaveName} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editNameInput}
                    onChange={(e) => setEditNameInput(e.target.value)}
                    autoFocus
                    placeholder="Enter device name..."
                    className="w-full px-2.5 py-1 rounded-lg text-base font-bold bg-slate-50 dark:bg-slate-800 border border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold"
                  >
                    Save
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-1.5 group">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate">
                    {deviceInfo.deviceName}
                  </h2>
                  <button
                    onClick={() => {
                      setEditNameInput(deviceInfo.deviceName);
                      setIsEditingName(true);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Edit device name"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                {deviceInfo.os} • {deviceInfo.browser}
              </p>
            </div>

            {/* High Density 6-Character Connection Code Display */}
            <div className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 p-4 text-center">
              <div className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                TEMPORARY PAIRING CODE
              </div>
              <div
                id="active-connection-code-display"
                className="mt-1 text-3xl sm:text-4xl font-mono font-black tracking-widest text-indigo-600 dark:text-indigo-400 select-all"
              >
                {connectionCode}
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Share this 6-character code with another device
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                id="copy-code-main-btn"
                onClick={handleCopyCode}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-semibold text-xs transition-all shadow-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied!" : "Copy Code"}</span>
              </button>

              <button
                id="show-qr-code-main-btn"
                onClick={onOpenQrModal}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Show QR Code</span>
              </button>
            </div>

            <button
              id="regenerate-code-btn"
              onClick={onOpenRegenerateModal}
              className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Generate New Code</span>
            </button>
          </div>
        </div>

        {/* Card 2: Connect To Another Device */}
        <div
          id="connect-other-device-card"
          className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-indigo-600 dark:text-indigo-400">
                PAIR PEER
              </span>
              <button
                type="button"
                onClick={onOpenConnectModal}
                className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
              >
                <Camera className="w-3 h-3" />
                <span>Scan QR</span>
              </button>
            </div>

            <h2 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">
              Pair with another device
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Enter the 6-character code shown on your other device to send a connection request.
            </p>

            <form onSubmit={handleQuickConnect} className="mt-4 space-y-3">
              <div>
                <label className="block text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  ENTER 6-CHARACTER CODE
                </label>
                <input
                  id="home-quick-connect-input"
                  type="text"
                  maxLength={6}
                  value={quickCode}
                  onChange={(e) => {
                    setQuickCode(e.target.value.toUpperCase());
                    setQuickError(null);
                  }}
                  placeholder="e.g. A7K9P2"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-center font-mono text-xl font-bold tracking-widest text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 uppercase transition-all"
                />
              </div>

              {quickError && (
                <div className="rounded-lg bg-rose-50 dark:bg-rose-950/40 p-2 text-xs text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">
                  {quickError}
                </div>
              )}

              <button
                type="submit"
                id="home-quick-connect-btn"
                disabled={quickLoading || quickCode.trim().length !== 6}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs transition-all disabled:opacity-50 shadow-xs"
              >
                {quickLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Requesting Connection...</span>
                  </>
                ) : (
                  <>
                    <span>Request Connection</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Quick Active Connected Devices Glance */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-slate-600 dark:text-slate-400 text-[11px]">
                Connected Devices ({connectedPeers.length})
              </span>
              {peers.length > 0 && (
                <button
                  onClick={onNavigateToDevices}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold text-[11px]"
                >
                  View All ({peers.length})
                </button>
              )}
            </div>

            {peers.length === 0 ? (
              <div className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                No devices connected yet. Open this URL on your second device to connect.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {peers.map((peer) => (
                  <div
                    key={peer.deviceId}
                    onClick={() => onOpenChat(peer.deviceId)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        peer.status === "connected"
                          ? "bg-emerald-500"
                          : peer.status === "connecting" || peer.status === "reconnecting"
                          ? "bg-amber-500 animate-pulse"
                          : "bg-slate-400"
                      }`}
                    />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[110px]">
                      {peer.deviceName}
                    </span>
                    <MessageSquare className="w-3 h-3 text-slate-400" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
