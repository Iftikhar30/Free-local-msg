import React, { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import {
  AlertCircle,
  ArrowRight,
  Camera,
  CheckCircle2,
  KeyRound,
  Loader2,
  RefreshCw,
  Smartphone,
  VideoOff,
  X,
} from "lucide-react";

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (code: string) => Promise<{ success: boolean; error?: string }>;
}

export function ConnectModal({ isOpen, onClose, onConnect }: ConnectModalProps) {
  const [mode, setMode] = useState<"code" | "scan">("code");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scanner state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number | null>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);

  // Reset state when opening/closing
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCode("");
      setError(null);
      setCameraError(null);
      setScannedCode(null);
      setLoading(false);
      setMode("code");
    }
  }, [isOpen]);

  // Handle camera start/stop on mode change
  useEffect(() => {
    if (isOpen && mode === "scan") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, mode]);

  const stopCamera = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  const startCamera = async () => {
    stopCamera();
    setCameraError(null);
    setScannedCode(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Camera access is not supported by your browser in this environment.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
        setIsScanning(true);
        requestAnimationFrame(tickScan);
      }
    } catch (err: any) {
      console.warn("Camera access failed:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError("Camera permission denied. Please allow camera access in browser settings.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setCameraError("No camera found on this device.");
      } else {
        setCameraError(err.message || "Failed to access camera.");
      }
    }
  };

  const extractCodeFromData = (raw: string): string | null => {
    if (!raw) return null;
    const trimmed = raw.trim();

    // Check if URL with connect= or code= parameter
    try {
      if (trimmed.includes("?") || trimmed.startsWith("http")) {
        const parsed = new URL(trimmed, window.location.origin);
        const codeParam = parsed.searchParams.get("connect") || parsed.searchParams.get("code");
        if (codeParam && codeParam.trim().length === 6) {
          return codeParam.trim().toUpperCase();
        }
      }
    } catch {}

    // Check if plain 6-character code
    const clean = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean.length === 6) {
      return clean;
    }

    return null;
  };

  const tickScan = () => {
    if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animationFrameId.current = requestAnimationFrame(tickScan);
      return;
    }

    const video = videoRef.current;
    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (decoded && decoded.data) {
        const foundCode = extractCodeFromData(decoded.data);
        if (foundCode) {
          // Detected a valid code!
          setScannedCode(foundCode);
          stopCamera();
          handleScannedConnect(foundCode);
          return;
        }
      }
    }

    animationFrameId.current = requestAnimationFrame(tickScan);
  };

  const handleScannedConnect = async (targetCode: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await onConnect(targetCode);
      if (res.success) {
        onClose();
      } else {
        setError(res.error || `Could not connect to device ${targetCode}.`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to initiate connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length !== 6) {
      setError("Please enter a valid 6-character connection code.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await onConnect(clean);
      if (res.success) {
        setCode("");
        onClose();
      } else {
        setError(res.error || "Connection request failed. Please check the code.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="connect-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        id="connect-modal-content"
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Connect Device</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Pair peer via code or camera scan</p>
            </div>
          </div>
          <button
            id="close-connect-modal-btn"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="mt-3.5 flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
          <button
            type="button"
            id="connect-tab-code-btn"
            onClick={() => setMode("code")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
              mode === "code"
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Enter Code</span>
          </button>

          <button
            type="button"
            id="connect-tab-scan-btn"
            onClick={() => setMode("scan")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
              mode === "scan"
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Scan QR Code</span>
          </button>
        </div>

        {/* TAB 1: Enter Code Mode */}
        {mode === "code" && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div>
              <label className="block text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Target Device Code
              </label>
              <div className="relative">
                <input
                  id="target-device-code-input"
                  type="text"
                  maxLength={6}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setError(null);
                  }}
                  placeholder="e.g. A7K9P2"
                  autoFocus
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-center font-mono text-2xl font-black tracking-widest text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none uppercase transition-all"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 text-center">
                Look at the 6-character code on your target device's screen.
              </p>
            </div>

            {error && (
              <div className="rounded-lg bg-rose-50 dark:bg-rose-950/50 p-2 text-xs text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                id="cancel-connect-btn"
                onClick={onClose}
                className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="send-connect-request-btn"
                disabled={loading || code.trim().length !== 6}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs transition-colors shadow-xs"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    Connect
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: Scan QR Code Mode */}
        {mode === "scan" && (
          <div className="mt-4 space-y-3">
            <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
              {/* Live Video */}
              <video
                ref={videoRef}
                className={`w-full h-full object-cover ${cameraError ? "hidden" : "block"}`}
                muted
              />

              {/* Target Scan Reticle Overlay */}
              {isScanning && !cameraError && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-indigo-500/80 rounded-xl relative">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-indigo-400 -mt-1 -ml-1 rounded-tl-sm" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-indigo-400 -mt-1 -mr-1 rounded-tr-sm" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-indigo-400 -mb-1 -ml-1 rounded-bl-sm" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-indigo-400 -mb-1 -mr-1 rounded-br-sm" />
                    <div className="w-full h-0.5 bg-indigo-400/80 absolute top-1/2 -translate-y-1/2 animate-pulse shadow-sm" />
                  </div>
                </div>
              )}

              {/* Camera Error Display */}
              {cameraError && (
                <div className="p-4 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-rose-900/40 text-rose-400 flex items-center justify-center mx-auto">
                    <VideoOff className="w-5 h-5" />
                  </div>
                  <p className="text-xs text-rose-300 font-medium">{cameraError}</p>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Try Again</span>
                  </button>
                </div>
              )}

              {/* Scanned code detected state */}
              {scannedCode && (
                <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-4 text-center text-white">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 animate-bounce mb-2" />
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">CODE FOUND</div>
                  <div className="text-2xl font-mono font-bold tracking-widest text-emerald-400">
                    {scannedCode}
                  </div>
                  <p className="text-xs text-slate-300 mt-1">Connecting now...</p>
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-lg bg-rose-50 dark:bg-rose-950/50 p-2 text-xs text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
                {error}
              </div>
            )}

            <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
              Point your camera at the QR code displayed on the other device.
            </p>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setMode("code")}
                className="w-full py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs transition-colors"
              >
                Switch to Manual Code
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
