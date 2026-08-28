import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, QrCode, X } from "lucide-react";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionCode: string;
  deviceName: string;
}

export function QRCodeModal({ isOpen, onClose, connectionCode, deviceName }: QRCodeModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrUrl, setQrUrl] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    // Generate pairing URL with the temporary connection code
    const origin = window.location.origin;
    const url = `${origin}/?connect=${encodeURIComponent(connectionCode)}`;
    setQrUrl(url);

    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: 240,
        margin: 2,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      }).catch((err) => {
        console.error("QR Code rendering error:", err);
      });
    }
  }, [isOpen, connectionCode]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(qrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      id="qr-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        id="qr-modal-content"
        className="w-full max-w-xs rounded-xl bg-white p-5 shadow-2xl dark:bg-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Device QR Code</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">Scan from camera or phone</p>
            </div>
          </div>
          <button
            id="close-qr-modal-btn"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="my-4 flex flex-col items-center justify-center">
          <div className="rounded-lg bg-white p-2 shadow-inner border border-slate-200">
            <canvas ref={canvasRef} className="rounded-md" />
          </div>

          <div className="mt-3 text-center">
            <div className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400">CONNECTION CODE</div>
            <div className="mt-0.5 text-2xl font-mono font-black tracking-widest text-indigo-600 dark:text-indigo-400">
              {connectionCode}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Identity: <span className="font-bold text-slate-700 dark:text-slate-300">{deviceName}</span>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <button
            id="copy-qr-link-btn"
            onClick={handleCopyLink}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shadow-xs"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Connection Link Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy Direct Connection Link
              </>
            )}
          </button>

          <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 font-mono pt-1">
            Zero personal data transmitted in code.
          </p>
        </div>
      </div>
    </div>
  );
}
