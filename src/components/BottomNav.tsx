import { Info, Home, MessageSquare, Settings, Smartphone } from "lucide-react";
import { AppTab } from "../types";

interface BottomNavProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  connectedCount: number;
  unreadTotal: number;
}

export function BottomNav({
  activeTab,
  setActiveTab,
  connectedCount,
  unreadTotal,
}: BottomNavProps) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-lg">
      <button
        id="mobile-nav-home"
        onClick={() => setActiveTab("home")}
        className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-colors ${
          activeTab === "home"
            ? "text-indigo-600 dark:text-indigo-400 font-bold"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
        }`}
      >
        <Home className="w-4 h-4" />
        <span className="text-[10px]">Home</span>
      </button>

      <button
        id="mobile-nav-devices"
        onClick={() => setActiveTab("devices")}
        className={`relative flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-colors ${
          activeTab === "devices"
            ? "text-indigo-600 dark:text-indigo-400 font-bold"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
        }`}
      >
        <div className="relative">
          <Smartphone className="w-4 h-4" />
          {connectedCount > 0 && (
            <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full bg-emerald-500 text-white text-[8px] font-bold">
              {connectedCount}
            </span>
          )}
        </div>
        <span className="text-[10px]">Devices</span>
      </button>

      <button
        id="mobile-nav-chat"
        onClick={() => setActiveTab("chat")}
        className={`relative flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-colors ${
          activeTab === "chat"
            ? "text-indigo-600 dark:text-indigo-400 font-bold"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
        }`}
      >
        <div className="relative">
          <MessageSquare className="w-4 h-4" />
          {unreadTotal > 0 && (
            <span className="absolute -top-1 -right-2 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[8px] font-bold animate-pulse">
              {unreadTotal}
            </span>
          )}
        </div>
        <span className="text-[10px]">Chat</span>
      </button>

      <button
        id="mobile-nav-about"
        onClick={() => setActiveTab("about")}
        className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-colors ${
          activeTab === "about"
            ? "text-indigo-600 dark:text-indigo-400 font-bold"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
        }`}
      >
        <Info className="w-4 h-4" />
        <span className="text-[10px]">About</span>
      </button>

      <button
        id="mobile-nav-settings"
        onClick={() => setActiveTab("settings")}
        className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-colors ${
          activeTab === "settings"
            ? "text-indigo-600 dark:text-indigo-400 font-bold"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
        }`}
      >
        <Settings className="w-4 h-4" />
        <span className="text-[10px]">Settings</span>
      </button>
    </nav>
  );
}
