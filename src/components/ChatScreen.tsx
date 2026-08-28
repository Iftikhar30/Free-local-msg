import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Check,
  CheckCheck,
  Copy,
  Laptop,
  MessageSquare,
  Paperclip,
  Plus,
  Radio,
  Send,
  ShieldCheck,
  Smartphone,
  Tablet,
  Trash2,
  Unplug,
} from "lucide-react";
import { ChatMessage, ConnectedPeer } from "../types";

interface ChatScreenProps {
  peers: ConnectedPeer[];
  activePeer: ConnectedPeer | null;
  activeChatMessages: ChatMessage[];
  isTargetTyping: boolean;
  onSelectPeer: (peerId: string) => void;
  onSendMessage: (peerId: string, text: string) => boolean;
  onSendTypingIndicator: (peerId: string, isTyping: boolean) => void;
  onDisconnectPeer: (peerId: string) => void;
  onOpenConnectModal: () => void;
}

export function ChatScreen({
  peers,
  activePeer,
  activeChatMessages,
  isTargetTyping,
  onSelectPeer,
  onSendMessage,
  onSendTypingIndicator,
  onDisconnectPeer,
  onOpenConnectModal,
}: ChatScreenProps) {
  const [inputText, setInputText] = useState("");
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [showFileNotice, setShowFileNotice] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChatMessages, isTargetTyping]);

  // Handle typing debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (activePeer) {
      onSendTypingIndicator(activePeer.deviceId, true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onSendTypingIndicator(activePeer.deviceId, false);
      }, 1500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!activePeer || !inputText.trim()) return;

    const success = onSendMessage(activePeer.deviceId, inputText);
    if (success) {
      setInputText("");
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      onSendTypingIndicator(activePeer.deviceId, false);
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const formatMessageTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDeviceIcon = (peer: ConnectedPeer) => {
    if (peer.deviceType === "phone") return <Smartphone className="w-4 h-4" />;
    if (peer.deviceType === "tablet") return <Tablet className="w-4 h-4" />;
    return <Laptop className="w-4 h-4" />;
  };

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-110px)] min-h-[480px] flex flex-col md:flex-row rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      {/* Sidebar: Peer List */}
      <div
        className={`w-full md:w-72 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50/50 dark:bg-slate-900/50 ${
          activePeer ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="px-3.5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white">Conversations</h2>
          </div>
          <button
            onClick={onOpenConnectModal}
            className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-colors"
            title="Connect another device"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1.5 space-y-0.5">
          {peers.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
              No devices connected yet.
              <button
                onClick={onOpenConnectModal}
                className="mt-2 block mx-auto text-indigo-600 dark:text-indigo-400 font-semibold hover:underline text-xs"
              >
                + Connect Device
              </button>
            </div>
          ) : (
            peers.map((peer) => {
              const isSelected = activePeer?.deviceId === peer.deviceId;
              const isOnline = peer.status === "connected";

              return (
                <div
                  key={peer.deviceId}
                  id={`chat-peer-item-${peer.deviceId}`}
                  onClick={() => onSelectPeer(peer.deviceId)}
                  className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-center gap-2.5 ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {getDeviceIcon(peer)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4
                        className={`text-xs font-bold truncate ${
                          isSelected ? "text-white" : "text-slate-900 dark:text-white"
                        }`}
                      >
                        {peer.deviceName}
                      </h4>
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isOnline
                            ? "bg-emerald-400"
                            : isSelected
                            ? "bg-amber-300 animate-pulse"
                            : "bg-slate-400"
                        }`}
                      />
                    </div>

                    <div className="flex items-center justify-between mt-0.5">
                      <p
                        className={`text-[11px] truncate ${
                          isSelected ? "text-indigo-100" : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {peer.lastMessage ? peer.lastMessage.text : "No messages yet"}
                      </p>
                      {peer.unreadCount > 0 && !isSelected && (
                        <span className="px-1.5 py-0.2 rounded-full font-mono bg-rose-500 text-white text-[9px] font-bold">
                          {peer.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Pane */}
      <div
        className={`flex-1 flex flex-col bg-white dark:bg-slate-900 ${
          !activePeer ? "hidden md:flex" : "flex"
        }`}
      >
        {activePeer ? (
          <>
            {/* Chat Header */}
            <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => onSelectPeer("")}
                  className="md:hidden p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  {getDeviceIcon(activePeer)}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {activePeer.deviceName}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-mono font-semibold ${
                        activePeer.status === "connected"
                          ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                          : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 animate-pulse"
                      }`}
                    >
                      <span
                        className={`w-1 h-1 rounded-full ${
                          activePeer.status === "connected" ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                      />
                      <span>{activePeer.status === "connected" ? "ONLINE" : "CONNECTING"}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span>WebRTC DataChannel</span>
                    {activePeer.latencyMs !== undefined && activePeer.status === "connected" && (
                      <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-mono text-[10px]">
                        <Activity className="w-2.5 h-2.5" />
                        {activePeer.latencyMs}ms
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Chat Header Actions */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onDisconnectPeer(activePeer.deviceId)}
                  className="flex items-center gap-1 py-1 px-2.5 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs font-semibold transition-colors"
                  title="Disconnect Peer"
                >
                  <Unplug className="w-3 h-3" />
                  <span className="hidden sm:inline">Disconnect</span>
                </button>
              </div>
            </div>

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-slate-50/40 dark:bg-slate-950/30">
              {/* Privacy Notice Banner */}
              <div className="max-w-sm mx-auto rounded-lg bg-slate-100/80 dark:bg-slate-800/60 p-2 text-center text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5 border border-slate-200/60 dark:border-slate-700/60">
                <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                <span>Direct peer-to-peer WebRTC • Zero server logs</span>
              </div>

              {activeChatMessages.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  <p>Start a conversation with {activePeer.deviceName}.</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">Send a quick greeting below.</p>
                </div>
              ) : (
                activeChatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col group ${msg.isMine ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-end gap-1.5 max-w-[88%] sm:max-w-[75%]">
                      {/* Message Bubble */}
                      <div
                        className={`relative px-3.5 py-2 rounded-xl text-xs break-words shadow-2xs ${
                          msg.isMine
                            ? "bg-indigo-600 text-white rounded-br-xs"
                            : "bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700/80 rounded-bl-xs"
                        }`}
                      >
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>

                        {/* Footer info: time & delivery status */}
                        <div
                          className={`mt-0.5 flex items-center justify-end gap-1 text-[9px] font-mono ${
                            msg.isMine ? "text-indigo-200" : "text-slate-400"
                          }`}
                        >
                          <span>{formatMessageTime(msg.timestamp)}</span>
                          {msg.isMine && (
                            <span>
                              {msg.status === "sending" && <span className="text-indigo-300">⋯</span>}
                              {msg.status === "sent" && <Check className="w-2.5 h-2.5 text-indigo-200" />}
                              {(msg.status === "delivered" || msg.status === "read") && (
                                <CheckCheck
                                  className={`w-3 h-3 ${
                                    msg.status === "read" ? "text-emerald-300" : "text-indigo-200"
                                  }`}
                                />
                              )}
                              {msg.status === "failed" && (
                                <span className="text-rose-300 font-bold">Failed</span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Copy message button */}
                      <button
                        onClick={() => handleCopyMessage(msg.id, msg.text)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-opacity"
                        title="Copy message"
                      >
                        {copiedMsgId === msg.id ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}

              {/* Peer typing indicator */}
              {isTargetTyping && (
                <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 animate-pulse font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <span>{activePeer.deviceName} is typing...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* File Attachment Notification */}
            {showFileNotice && (
              <div className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 border-t border-indigo-200 dark:border-indigo-900 text-[11px] text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
                <span>
                  📁 <strong>File Transfer Ready:</strong> WebRTC channel includes <code className="bg-indigo-100 dark:bg-indigo-900 px-1 py-0.2 rounded font-mono">sendFile()</code> binary chunking.
                </span>
                <button
                  onClick={() => setShowFileNotice(false)}
                  className="font-bold text-indigo-500 hover:text-indigo-800"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Input Bar */}
            <div className="p-2.5 sm:p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex items-end gap-1.5">
                <button
                  onClick={() => setShowFileNotice(true)}
                  className="p-2.5 rounded-xl text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Attach file"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <div className="flex-1 relative">
                  <textarea
                    id="chat-message-input"
                    ref={textareaRef}
                    value={inputText}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message ${activePeer.deviceName}... (Enter to send, Shift+Enter for newline)`}
                    rows={1}
                    className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none max-h-28 transition-all"
                  />
                </div>

                <button
                  id="send-message-btn"
                  onClick={handleSend}
                  disabled={!inputText.trim()}
                  className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-40 text-white shadow-xs transition-all"
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 px-0.5">
                <span>Private P2P Channel</span>
                <span>Press Enter ↵ to send</span>
              </div>
            </div>
          </>
        ) : (
          /* Empty Chat state when no peer is selected */
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-3">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Select a Device</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 max-w-xs">
              Choose a connected device from the sidebar or connect a new device to start messaging.
            </p>
            <button
              onClick={onOpenConnectModal}
              className="mt-3.5 inline-flex items-center gap-1 py-1.5 px-3.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold shadow-xs hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect Device</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
