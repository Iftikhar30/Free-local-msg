import React, { useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, RotateCcw } from "lucide-react";
import { VoiceMessageItem } from "../types";

interface VoiceMessagePlayerProps {
  voice: VoiceMessageItem;
  isMine?: boolean;
}

export function VoiceMessagePlayer({ voice, isMine }: VoiceMessagePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Generate fallback waveform if none provided
  const waveform = voice.waveformData && voice.waveformData.length > 0
    ? voice.waveformData
    : [20, 45, 60, 30, 80, 50, 65, 90, 75, 40, 60, 85, 30, 70, 55, 90, 45, 35, 65, 80, 50, 30, 20, 15];

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const durationSec = voice.duration || 1;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handlePause = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !voice.url) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.playbackRate = playbackRate;
      audio.play().catch((e) => console.warn("Playback prevented:", e));
    }
  };

  const handleSeek = (index: number) => {
    const audio = audioRef.current;
    if (!audio || !voice.url) return;

    const targetRatio = index / waveform.length;
    const targetTime = targetRatio * (audio.duration || durationSec);
    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const cycleSpeed = () => {
    const rates: (1 | 1.5 | 2)[] = [1, 1.5, 2];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const progressPercent = (currentTime / (durationSec || 1)) * 100;

  return (
    <div className="flex items-center gap-2.5 py-1 min-w-[240px] max-w-[320px] select-none">
      {voice.url && <audio ref={audioRef} src={voice.url} preload="metadata" />}

      {/* Play/Pause Circle Button */}
      <button
        type="button"
        onClick={togglePlay}
        disabled={!voice.url}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-xs cursor-pointer ${
          isMine
            ? "bg-white text-indigo-600 hover:bg-slate-100"
            : "bg-indigo-600 text-white hover:bg-indigo-700"
        } ${!voice.url ? "opacity-50 cursor-not-allowed" : ""}`}
        title={isPlaying ? "Pause" : "Play Voice Message"}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>

      {/* Waveform & Time Track */}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        {/* Waveform Bar Graphic (interactive scrubber) */}
        <div className="flex items-center gap-[2px] h-6 cursor-pointer py-1" onClick={(e) => e.stopPropagation()}>
          {waveform.map((val, idx) => {
            const barProgress = (idx / waveform.length) * 100;
            const isFilled = barProgress <= progressPercent;

            return (
              <div
                key={idx}
                onClick={() => handleSeek(idx)}
                className="flex-1 h-full flex items-center justify-center group"
                title={`Seek to ${Math.round((idx / waveform.length) * durationSec)}s`}
              >
                <div
                  className={`w-full rounded-full transition-all duration-100 ${
                    isMine
                      ? isFilled
                        ? "bg-white"
                        : "bg-indigo-300/50 hover:bg-indigo-200"
                      : isFilled
                      ? "bg-indigo-600 dark:bg-indigo-400"
                      : "bg-slate-300 dark:bg-slate-700 hover:bg-slate-400"
                  }`}
                  style={{
                    height: `${Math.max(15, (val / 100) * 100)}%`,
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Duration / Timer & Speed Controls */}
        <div
          className={`flex items-center justify-between text-[10px] font-mono leading-none ${
            isMine ? "text-indigo-100" : "text-slate-500 dark:text-slate-400"
          }`}
        >
          <span>{formatTime(isPlaying ? currentTime : durationSec)}</span>

          <div className="flex items-center gap-1.5">
            {/* Speed rate toggle button */}
            <button
              type="button"
              onClick={cycleSpeed}
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors cursor-pointer ${
                isMine
                  ? "bg-indigo-700/50 text-white hover:bg-indigo-700"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300"
              }`}
              title="Change playback speed"
            >
              {playbackRate}x
            </button>
            <Mic className={`w-3 h-3 ${isMine ? "text-indigo-200" : "text-slate-400"}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
