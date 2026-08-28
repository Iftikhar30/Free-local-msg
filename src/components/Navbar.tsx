import React, { useState } from "react";
import {
  Bell,
  BellOff,
  ChevronRight,
  Edit2,
  HardDrive,
  Laptop,
  Moon,
  Plus,
  Radio,
  ShieldCheck,
  Smartphone,
  Sun,
} from "lucide-react";
import { DeviceInfo } from "../types";

interface NavbarProps {
  deviceInfo: DeviceInfo;
  activeTab: "home" | "devices" | "chat" | "settings";
  setActiveTab: (tab: "home" | "devices" | "chat" | "settings") => void;
  connectedCount: number;
  unreadTotal: number;
  isSignalingReady: boolean;
  onOpenConnectModal: () => void;
  onUpdateDeviceName: (name: string) => void;
  soundEnabled: boolean;
  setSoundEnabled: (val: boolean) => void;
}

export function Navbar({
  deviceInfo,
  activeTab,
  setActiveTab,
  connectedCount,
  unreadTotal,
  isSignalingReady,
  onOpenConnectModal,
  onUpdateDeviceName,
  soundEnabled,
  setSoundEnabled,
}: NavbarProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(deviceInfo.deviceName);
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.classList.contains("dark") || window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const toggleDarkMode = () => {
    if (isDark) {
      document.documentElement.classList.remove("dark");
      setIsDark(false);
    } else {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }
  };

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameInput.trim()) {
      onUpdateDeviceName(nameInput.trim());
    }
    setIsEditingName(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div
              id="brand-logo-container"
              onClick={() => setActiveTab("home")}
              className="flex items-center gap-2 cursor-pointer group select-none"
            >
              <div className="w-8 h-8 rounded-lg bg-linear-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
                    Local<span className="text-indigo-600 dark:text-indigo-400">Link</span>
                  </span>
                  <span className="px-1 py-0.2 rounded text-[9px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
                    P2P
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-none">
                  <ShieldCheck className="w-2.5 h-2.5 text-emerald-500" />
                  <span>WebRTC Direct</span>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
            <button
              id="nav-tab-home"
              onClick={() => setActiveTab("home")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                activeTab === "home"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/50 dark:border-slate-700/50"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Home
            </button>
            <button
              id="nav-tab-devices"
              onClick={() => setActiveTab("devices")}
              className={`relative px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                activeTab === "devices"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/50 dark:border-slate-700/50"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <span>Devices</span>
              {connectedCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full font-mono text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  {connectedCount}
                </span>
              )}
            </button>
            <button
              id="nav-tab-chat"
              onClick={() => setActiveTab("chat")}
              className={`relative px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                activeTab === "chat"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/50 dark:border-slate-700/50"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <span>Chat</span>
              {unreadTotal > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full font-mono text-[9px] font-bold bg-rose-500 text-white animate-pulse">
                  {unreadTotal}
                </span>
              )}
            </button>
            <button
              id="nav-tab-settings"
              onClick={() => setActiveTab("settings")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                activeTab === "settings"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/50 dark:border-slate-700/50"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Settings
            </button>
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Device Name Chip */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-700 dark:text-slate-300">
              {deviceInfo.deviceType === "phone" ? (
                <Smartphone className="w-3.5 h-3.5 text-slate-500" />
              ) : (
                <Laptop className="w-3.5 h-3.5 text-slate-500" />
              )}
              {isEditingName ? (
                <form onSubmit={handleSaveName} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    autoFocus
                    onBlur={() => setIsEditingName(false)}
                    className="w-24 px-1.5 py-0.5 rounded text-xs bg-white dark:bg-slate-900 border border-indigo-500 focus:outline-none"
                  />
                </form>
              ) : (
                <div
                  onClick={() => {
                    setNameInput(deviceInfo.deviceName);
                    setIsEditingName(true);
                  }}
                  className="flex items-center gap-1 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  title="Click to rename this device"
                >
                  <span className="font-semibold max-w-[110px] truncate">{deviceInfo.deviceName}</span>
                  <Edit2 className="w-3 h-3 text-slate-400" />
                </div>
              )}
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isSignalingReady ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
                }`}
                title={isSignalingReady ? "Signaling Connected" : "Connecting to Signaling..."}
              />
            </div>

            {/* Quick Connect Button */}
            <button
              id="navbar-connect-btn"
              onClick={onOpenConnectModal}
              className="flex items-center gap-1 py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-all active:scale-98"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect</span>
            </button>

            {/* Sound Toggle */}
            <button
              id="sound-toggle-btn"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Mute audio alerts" : "Enable audio alerts"}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors"
            >
              {soundEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4 text-slate-400" />}
            </button>

            {/* Theme Toggle */}
            <button
              id="theme-toggle-btn"
              onClick={toggleDarkMode}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
