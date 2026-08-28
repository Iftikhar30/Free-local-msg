import { AlertTriangle, RefreshCw, X } from "lucide-react";

interface RegenerateCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentCode: string;
}

export function RegenerateCodeModal({
  isOpen,
  onClose,
  onConfirm,
  currentCode,
}: RegenerateCodeModalProps) {
  if (!isOpen) return null;

  return (
    <div
      id="regenerate-code-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        id="regenerate-code-modal-content"
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <RefreshCw className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Generate New Code?
            </h3>
          </div>
          <button
            id="close-regenerate-modal-btn"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="my-4 space-y-2.5">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Your current connection code (
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
              {currentCode}
            </span>
            ) will be replaced with a fresh 6-character code.
          </p>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400">
            • Old pending connection requests using this code will be invalidated.<br />
            • Any already connected devices will stay connected.
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            id="cancel-regenerate-code-btn"
            onClick={onClose}
            className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            id="confirm-regenerate-code-btn"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Generate New Code</span>
          </button>
        </div>
      </div>
    </div>
  );
}
