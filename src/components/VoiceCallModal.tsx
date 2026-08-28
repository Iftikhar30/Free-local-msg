import React from "react";
import {
  Laptop,
  Mic,
  MicOff,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  ShieldCheck,
  Smartphone,
  Tablet,
  Volume2,
  VolumeX,
} from "lucide-react";
import { ActiveCallState, DeviceType } from "../types";

interface VoiceCallModalProps {
  call: ActiveCallState;
  onAccept: () => void;
  onReject: () => void;
  onEndCall?: () => void;
  onEnd?: () => void;
  onToggleMute: () => void;
}

export function VoiceCallModal({
  call,
  onAccept,
  onReject,
  onEndCall,
  onEnd,
  onToggleMute,
}: VoiceCallModalProps) {
  const handleEnd = onEndCall || onEnd || (() => {});
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getDeviceIcon = (type?: DeviceType) => {
    if (type === "phone") return <Smartphone className="w-8 h-8" />;
    if (type === "tablet") return <Tablet className="w-8 h-8" />;
    return <Laptop className="w-8 h-8" />;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 rounded-3xl p-6 text-white shadow-2xl border border-slate-800 flex flex-col items-center text-center overflow-hidden">
        {/* Background Ambient Glow */}
        <div className="absolute -top-20 -left-20 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Security badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[10px] text-slate-300 mb-6">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Direct P2P Encrypted Audio</span>
        </div>

        {/* Device Avatar / Pulsing Indicator */}
        <div className="relative mb-6">
          {/* Animated pulsing rings when ringing/calling */}
          {(call.status === "incoming_ringing" || call.status === "outgoing_calling") && (
            <>
              <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
              <div className="absolute -inset-3 rounded-full bg-indigo-500/10 animate-pulse" />
            </>
          )}

          {call.status === "connected" && (
            <div className="absolute -inset-2 rounded-full bg-emerald-500/20 animate-pulse" />
          )}

          <div
            className={`relative w-24 h-24 rounded-full flex items-center justify-center border-2 transition-all ${
              call.status === "connected"
                ? "bg-emerald-950/60 border-emerald-500 text-emerald-400"
                : "bg-indigo-950/60 border-indigo-500/80 text-indigo-400 shadow-xl"
            }`}
          >
            {getDeviceIcon(call.peerDeviceType)}
          </div>
        </div>

        {/* Call Info & Name */}
        <h3 className="text-xl font-bold text-white tracking-tight mb-1 truncate max-w-xs">
          {call.peerName}
        </h3>

        {/* Call Status Text & Timer */}
        <div className="mb-8">
          {call.status === "incoming_ringing" && (
            <p className="text-sm text-indigo-300 font-medium flex items-center justify-center gap-1.5 animate-pulse">
              <PhoneIncoming className="w-4 h-4" />
              <span>Incoming Voice Call...</span>
            </p>
          )}

          {call.status === "outgoing_calling" && (
            <p className="text-sm text-indigo-300 font-medium flex items-center justify-center gap-1.5 animate-pulse">
              <PhoneCall className="w-4 h-4" />
              <span>Calling {call.peerName}...</span>
            </p>
          )}

          {call.status === "connected" && (
            <div className="space-y-2">
              <p className="text-sm font-mono font-bold text-emerald-400 tracking-wider">
                {formatDuration(call.duration)}
              </p>

              {/* Animated audio frequency waveform bars */}
              <div className="flex items-center justify-center gap-1 h-6">
                {[12, 24, 16, 28, 20, 32, 18, 26, 14, 22].map((height, i) => (
                  <div
                    key={i}
                    className="w-1 bg-emerald-400 rounded-full transition-all duration-150 animate-pulse"
                    style={{
                      height: `${call.isMuted ? 4 : height}px`,
                      animationDelay: `${i * 100}ms`,
                    }}
                  />
                ))}
              </div>

              {call.isRemoteMuted && (
                <p className="text-[11px] text-amber-400">Peer is muted</p>
              )}
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="w-full">
          {/* Incoming Ringing Controls: Accept or Decline */}
          {call.status === "incoming_ringing" && (
            <div className="flex items-center justify-center gap-8">
              {/* Decline Button */}
              <div className="flex flex-col items-center gap-1.5">
                <button
                  id="decline-voice-call-btn"
                  onClick={onReject}
                  className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg active:scale-95 transition-all cursor-pointer"
                  title="Decline Call"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
                <span className="text-xs text-slate-400 font-medium">Decline</span>
              </div>

              {/* Accept Button */}
              <div className="flex flex-col items-center gap-1.5">
                <button
                  id="accept-voice-call-btn"
                  onClick={onAccept}
                  className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg active:scale-95 transition-all animate-bounce cursor-pointer"
                  title="Answer Call"
                >
                  <Phone className="w-6 h-6" />
                </button>
                <span className="text-xs text-emerald-400 font-medium">Answer</span>
              </div>
            </div>
          )}

          {/* Outgoing Calling Controls: End Call */}
          {call.status === "outgoing_calling" && (
            <div className="flex flex-col items-center gap-2">
              <button
                id="cancel-voice-call-btn"
                onClick={handleEnd}
                className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg active:scale-95 transition-all cursor-pointer"
                title="Cancel Call"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
              <span className="text-xs text-slate-400 font-medium">Cancel</span>
            </div>
          )}

          {/* In-Call Active Controls: Mute Toggle & End Call */}
          {call.status === "connected" && (
            <div className="flex items-center justify-center gap-6">
              {/* Mute Button */}
              <div className="flex flex-col items-center gap-1.5">
                <button
                  id="toggle-mic-btn"
                  onClick={onToggleMute}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    call.isMuted
                      ? "bg-rose-500/20 border border-rose-500 text-rose-400"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  }`}
                  title={call.isMuted ? "Unmute Microphone" : "Mute Microphone"}
                >
                  {call.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <span className="text-[11px] text-slate-400">
                  {call.isMuted ? "Unmute" : "Mute"}
                </span>
              </div>

              {/* End Call Button */}
              <div className="flex flex-col items-center gap-1.5">
                <button
                  id="end-voice-call-btn"
                  onClick={handleEnd}
                  className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg active:scale-95 transition-all cursor-pointer"
                  title="End Call"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
                <span className="text-xs text-rose-400 font-medium">End Call</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
