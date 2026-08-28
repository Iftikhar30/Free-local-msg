import { IncomingConnectionRequest } from "../types";
import { Check, Laptop, Smartphone, X } from "lucide-react";

interface IncomingRequestModalProps {
  requests: IncomingConnectionRequest[];
  onAccept: (requestId: string) => void;
  onReject: (requestId: string) => void;
}

export function IncomingRequestModal({
  requests,
  onAccept,
  onReject,
}: IncomingRequestModalProps) {
  if (requests.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-xs w-full animate-in slide-in-from-bottom-5 duration-200">
      {requests.map((req) => (
        <div
          key={req.id}
          id={`incoming-req-${req.id}`}
          className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3.5 shadow-xl dark:shadow-indigo-950/40"
        >
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600 text-white shadow-xs shrink-0">
              {req.data?.deviceType === "phone" ? (
                <Smartphone className="w-4 h-4" />
              ) : (
                <Laptop className="w-4 h-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Connection Request
                </span>
              </div>
              <h4 className="mt-0.5 text-xs font-bold text-slate-900 dark:text-white truncate">
                {req.fromDeviceName}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                Direct WebRTC request
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1.5">
            <button
              id={`reject-req-${req.id}-btn`}
              onClick={() => onReject(req.id)}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors"
            >
              <X className="w-3.5 h-3.5 text-rose-500" />
              Reject
            </button>
            <button
              id={`accept-req-${req.id}-btn`}
              onClick={() => onAccept(req.id)}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Accept
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
