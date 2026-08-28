import React, { useEffect, useState } from "react";
import {
  Bell,
  BellOff,
  Check,
  CheckCircle2,
  ExternalLink,
  HardDrive,
  Info,
  Key,
  RefreshCw,
  Server,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { DeviceInfo, PushNotificationConfig } from "../types";
import { clearAllStorage, getCustomIceServers, setCustomIceServers } from "../services/device";
import { playMessageSound } from "../services/sound";
import { PushNotificationService } from "../services/pushNotification";

interface SettingsScreenProps {
  deviceInfo: DeviceInfo;
  connectionCode: string;
  isSignalingReady: boolean;
  soundEnabled: boolean;
  onSetSoundEnabled: (enabled: boolean) => void;
  onUpdateDeviceName: (name: string) => void;
  onOpenRegenerateModal: () => void;
  onNavigateToAbout: () => void;
}

export function SettingsScreen({
  deviceInfo,
  connectionCode,
  isSignalingReady,
  soundEnabled,
  onSetSoundEnabled,
  onUpdateDeviceName,
  onOpenRegenerateModal,
  onNavigateToAbout,
}: SettingsScreenProps) {
  const [nameInput, setNameInput] = useState(deviceInfo.deviceName);
  const [nameSaved, setNameSaved] = useState(false);

  // Push Notifications state
  const [pushConfig, setPushConfig] = useState<PushNotificationConfig>({
    supported: false,
    permission: "default",
    isSubscribed: false,
  });
  const [isPushLoading, setIsPushLoading] = useState(false);
  const [pushStatusMessage, setPushStatusMessage] = useState<string | null>(null);

  // Custom ICE servers
  const [iceServerInput, setIceServerInput] = useState("");
  const [iceSaved, setIceSaved] = useState(false);

  useEffect(() => {
    // Check initial push notification configuration
    PushNotificationService.getStatus().then(setPushConfig);

    const savedIce = getCustomIceServers();
    if (savedIce.length > 0) {
      setIceServerInput(JSON.stringify(savedIce, null, 2));
    }
  }, []);

  const handleTogglePushNotifications = async () => {
    setIsPushLoading(true);
    setPushStatusMessage(null);

    try {
      if (pushConfig.isSubscribed) {
        // Unsubscribe
        await PushNotificationService.unsubscribe(deviceInfo.deviceId);
        const next = await PushNotificationService.getStatus();
        setPushConfig(next);
        setPushStatusMessage("Push notifications have been disabled.");
      } else {
        // Subscribe
        const res = await PushNotificationService.subscribe(deviceInfo.deviceId, deviceInfo.deviceName);
        const next = await PushNotificationService.getStatus();
        setPushConfig(next);
        if (res.success) {
          setPushStatusMessage("Push notifications activated! You will receive calls & messages even when the app is closed.");
        } else {
          setPushStatusMessage(res.error || "Failed to enable notifications.");
        }
      }
    } catch (err: any) {
      setPushStatusMessage(err.message || "Failed to update notification settings.");
    } finally {
      setIsPushLoading(false);
      setTimeout(() => setPushStatusMessage(null), 5000);
    }
  };

  const handleSendTestPush = async () => {
    setIsPushLoading(true);
    setPushStatusMessage(null);

    const res = await PushNotificationService.sendTestNotification(deviceInfo.deviceId);
    setIsPushLoading(false);
    if (res.success) {
      setPushStatusMessage("Test notification sent! Check your device status bar / lockscreen.");
    } else {
      setPushStatusMessage(res.error || "Failed to send test push notification.");
    }
    setTimeout(() => setPushStatusMessage(null), 5000);
  };

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameInput.trim()) {
      onUpdateDeviceName(nameInput.trim());
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    }
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    onSetSoundEnabled(next);
    if (next) {
      playMessageSound();
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

  const handleResetData = () => {
    if (
      confirm(
        "Are you sure you want to clear all paired devices and chat history? Your current device identity will reset on next load."
      )
    ) {
      clearAllStorage();
      window.location.reload();
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-8">
      {/* Title */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Configure device identity, notifications, and WebRTC parameters.
        </p>
      </div>

      {/* 1. Device Profile Settings */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-2xs">
        <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <div className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
              Device Profile
            </h3>
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
              Environment: {deviceInfo.os} • {deviceInfo.browser}
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs border-t border-slate-100 dark:border-slate-800/60">
            <div>
              <span className="text-slate-400">Connection Code: </span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                {connectionCode}
              </span>
            </div>
            <button
              type="button"
              id="settings-rotate-code-btn"
              onClick={onOpenRegenerateModal}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs text-slate-700 dark:text-slate-300 font-medium transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Generate New Code</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. Background Push Notifications (Web Push API) */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                Background Push Notifications
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Receive calls and messages even if the app or browser tab is closed
              </p>
            </div>
          </div>

          <button
            type="button"
            id="toggle-push-btn"
            disabled={isPushLoading || !pushConfig.supported}
            onClick={handleTogglePushNotifications}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
              pushConfig.isSubscribed ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                pushConfig.isSubscribed ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="mt-3 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400">Status:</span>
              {pushConfig.isSubscribed ? (
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Active & Subscribed</span>
                </span>
              ) : pushConfig.permission === "denied" ? (
                <span className="font-semibold text-rose-500">Permission Blocked in Browser</span>
              ) : (
                <span className="font-medium text-slate-500 dark:text-slate-400">Disabled</span>
              )}
            </div>

            {pushConfig.isSubscribed && (
              <button
                type="button"
                id="send-test-push-btn"
                disabled={isPushLoading}
                onClick={handleSendTestPush}
                className="px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px] transition-colors disabled:opacity-50"
              >
                <span>Send Test Notification</span>
              </button>
            )}
          </div>

          {pushStatusMessage && (
            <div className="p-2 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200 animate-in fade-in duration-150">
              {pushStatusMessage}
            </div>
          )}

          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            Uses standard W3C Web Push & Service Worker protocols. When your phone screen is off or you switch apps, incoming calls ring and show notifications.
          </p>
        </div>
      </div>

      {/* 3. Notification & Sound Settings */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                Sound Effects & Chimes
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Play subtle audio tones for incoming connection requests and new messages
              </p>
            </div>
          </div>

          <button
            type="button"
            id="toggle-sound-btn"
            onClick={handleToggleSound}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              soundEnabled ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                soundEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* 3. WebRTC & STUN / TURN Traversal */}
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
            <div className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
              Default STUN Pool:
            </div>
            <div className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400">
              • stun:stun.l.google.com:19302<br />
              • stun:stun1.l.google.com:19302<br />
              • stun:stun2.l.google.com:19302
            </div>
            <p className="pt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
              No TURN server is required for initial direct local network and standard Internet testing.
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
                rows={2}
                className="w-full font-mono text-[11px] rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold text-xs transition-colors"
            >
              {iceSaved ? <Check className="w-3 h-3" /> : null}
              <span>{iceSaved ? "Saved Custom ICE" : "Save ICE Configuration"}</span>
            </button>
          </form>
        </div>
      </div>

      {/* 4. About LocalLink & Architecture Link */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-xs">About LocalLink</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Built with Google AI Studio • Privacy statement, diagnostics, and WebRTC lifecycle
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onNavigateToAbout}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 font-semibold text-xs transition-colors"
        >
          <span>View About</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      {/* 5. Storage & Reset */}
      <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 p-4 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-rose-800 dark:text-rose-300 text-xs">Reset Local Storage</h3>
          <p className="text-[11px] text-rose-700/80 dark:text-rose-400/80">
            Clear all cached paired peers and local message history
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetData}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 font-semibold text-xs hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Reset All</span>
        </button>
      </div>
    </div>
  );
}
