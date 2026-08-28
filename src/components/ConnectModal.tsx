import React, { useState } from "react";
import { ArrowRight, Loader2, Smartphone, X } from "lucide-react";

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (code: string) => Promise<{ success: boolean; error?: string }>;
}

export function ConnectModal({ isOpen, onClose, onConnect }: ConnectModalProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length < 4) {
      setError("Please enter a valid 6-character code.");
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

  return (
    <div
      id="connect-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        id="connect-modal-content"
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl dark:bg-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Connect Device</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">Pair via 6-character code</p>
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

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Target Device Code
            </label>
            <div className="relative">
              <input
                id="target-device-code-input"
                type="text"
                maxLength={8}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError(null);
                }}
                placeholder="e.g. A7K9P2"
                autoFocus
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-center font-mono text-xl font-bold tracking-widest text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none uppercase transition-all"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
              Check the Home screen of the other device to find its code.
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-rose-50 dark:bg-rose-950/50 p-2 text-xs text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
              {error}
            </div>
          )}

          <div className="pt-1 flex gap-2">
            <button
              type="button"
              id="cancel-connect-btn"
              onClick={onClose}
              className="flex-1 py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="send-connect-request-btn"
              disabled={loading || !code.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs transition-colors shadow-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Requesting...
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
      </div>
    </div>
  );
}
