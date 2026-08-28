import { useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clock,
  HardDrive,
  Info,
  Laptop,
  Loader2,
  MessageSquare,
  Plus,
  Radio,
  RefreshCw,
  Shield,
  Smartphone,
  Tablet,
  Trash2,
  Unplug,
  Wifi,
} from "lucide-react";
import { ConnectedPeer } from "../types";

interface DevicesScreenProps {
  peers: ConnectedPeer[];
  onOpenConnectModal: () => void;
  onOpenChat: (peerId: string) => void;
  onDisconnectPeer: (peerId: string) => void;
  onReconnectPeer: (peerId: string) => void;
  onRemovePeer: (peerId: string) => void;
}

export function DevicesScreen({
  peers,
  onOpenConnectModal,
  onOpenChat,
  onDisconnectPeer,
  onReconnectPeer,
  onRemovePeer,
}: DevicesScreenProps) {
  const [selectedDeviceInfo, setSelectedDeviceInfo] = useState<ConnectedPeer | null>(null);

  const getDeviceIcon = (peer: ConnectedPeer) => {
    if (peer.deviceType === "phone") return <Smartphone className="w-5 h-5" />;
    if (peer.deviceType === "tablet") return <Tablet className="w-5 h-5" />;
    return <Laptop className="w-5 h-5" />;
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return "Never";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
            Connected & Known Devices
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage your active WebRTC peer connections and paired device history ({peers.length} saved)
          </p>
        </div>
        <button
          onClick={onOpenConnectModal}
          className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-98"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Connect Device</span>
        </button>
      </div>

      {/* Empty State */}
      {peers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center bg-white/50 dark:bg-slate-900/50">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
            <Radio className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No Connected Devices</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            You haven't paired with any devices yet. Enter a 6-character code or scan a QR code from another device.
          </p>
          <button
            onClick={onOpenConnectModal}
            className="mt-4 inline-flex items-center gap-1.5 py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Connect Device Now</span>
          </button>
        </div>
      ) : (
        /* Peer List */
        <div className="grid grid-cols-1 gap-2.5">
          {peers.map((peer) => {
            const isOnline = peer.status === "connected" && peer.dataChannelStatus === "open";
            const isConnecting = peer.status === "connecting";
            const isReconnecting = peer.status === "reconnecting";
            const isDisconnected = peer.status === "disconnected" || peer.status === "failed";

            return (
              <div
                key={peer.deviceId}
                id={`device-card-${peer.deviceId}`}
                className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                {/* Device Icon & Info */}
                <div className="flex items-start sm:items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      isOnline
                        ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60"
                        : isConnecting || isReconnecting
                        ? "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {getDeviceIcon(peer)}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                        {peer.deviceName}
                      </h3>
                      {/* Status indicator badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-mono font-semibold ${
                          isOnline
                            ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                            : isConnecting || isReconnecting
                            ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 animate-pulse"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        <span
                          className={`w-1 h-1 rounded-full ${
                            isOnline ? "bg-emerald-500" : isConnecting || isReconnecting ? "bg-amber-500" : "bg-slate-400"
                          }`}
                        />
                        <span>
                          {isOnline
                            ? "ONLINE"
                            : isReconnecting
                            ? "RECONNECTING"
                            : isConnecting
                            ? "CONNECTING"
                            : "OFFLINE"}
                        </span>
                      </span>

                      {/* Unread badge */}
                      {peer.unreadCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full font-mono bg-rose-500 text-white text-[9px] font-bold">
                          {peer.unreadCount} new
                        </span>
                      )}
                    </div>

                    {/* Metadata line */}
                    <div className="mt-0.5 flex flex-wrap items-center gap-2.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      {peer.os && <span>OS: {peer.os}</span>}
                      {peer.connectionCode && <span>Code: {peer.connectionCode}</span>}
                      {peer.latencyMs !== undefined && isOnline && (
                        <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                          <Activity className="w-2.5 h-2.5" />
                          <span>{peer.latencyMs}ms</span>
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 text-slate-400" />
                        <span>Last active: {formatTime(peer.lastSeen)}</span>
                      </span>
                    </div>

                    {/* Last message preview */}
                    {peer.lastMessage && (
                      <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-sm">
                        <span className="font-semibold text-slate-400">
                          {peer.lastMessage.isMine ? "You: " : `${peer.deviceName}: `}
                        </span>
                        {peer.lastMessage.text}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => setSelectedDeviceInfo(peer)}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                    title="Device Information"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>

                  {isOnline ? (
                    <button
                      onClick={() => onDisconnectPeer(peer.deviceId)}
                      className="p-2 rounded-lg border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 transition-colors"
                      title="Disconnect Peer"
                    >
                      <Unplug className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => onReconnectPeer(peer.deviceId)}
                        disabled={isConnecting || isReconnecting}
                        className="inline-flex items-center gap-1 py-1.5 px-2.5 rounded-lg border border-indigo-200 dark:border-indigo-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-semibold transition-colors disabled:opacity-50"
                        title="Reconnect to device"
                      >
                        {isConnecting || isReconnecting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        <span>Reconnect</span>
                      </button>

                      <button
                        onClick={() => onRemovePeer(peer.deviceId)}
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 text-slate-400 transition-colors"
                        title="Remove Device from List"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => onOpenChat(peer.deviceId)}
                    className="flex items-center gap-1 py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Open Chat</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Device Info Modal */}
      {selectedDeviceInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          onClick={() => setSelectedDeviceInfo(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl dark:bg-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Device Diagnostics</h3>
              <button
                onClick={() => setSelectedDeviceInfo(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-400">Device Name</span>
                <span className="font-semibold">{selectedDeviceInfo.deviceName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-400">Connection Status</span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 uppercase">
                  {selectedDeviceInfo.status}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-400">WebRTC DataChannel</span>
                <span className="font-mono">{selectedDeviceInfo.dataChannelStatus}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-400">Round-Trip Latency</span>
                <span className="font-mono font-bold">
                  {selectedDeviceInfo.latencyMs ? `${selectedDeviceInfo.latencyMs} ms` : "Measuring..."}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-400">Transport Security</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-mono text-[11px]">DTLS / SCTP Encrypted</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Internal Device ID</span>
                <span className="font-mono text-[10px] text-slate-500 truncate max-w-[180px]">
                  {selectedDeviceInfo.deviceId}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <button
                onClick={() => setSelectedDeviceInfo(null)}
                className="w-full py-1.5 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
