import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Check,
  CheckCheck,
  Copy,
  Download,
  File,
  FileArchive,
  FileCode,
  FileSpreadsheet,
  FileText,
  Film,
  Image as ImageIcon,
  Laptop,
  MessageSquare,
  Music,
  Paperclip,
  Plus,
  Radio,
  Send,
  ShieldCheck,
  Smartphone,
  Tablet,
  Unplug,
  UploadCloud,
  X,
} from "lucide-react";
import { FileTransferService } from "../services/fileTransfer";
import { ChatMessage, ConnectedPeer, FileTransferItem } from "../types";

interface ChatScreenProps {
  peers: ConnectedPeer[];
  activePeer: ConnectedPeer | null;
  activeChatMessages: ChatMessage[];
  isTargetTyping: boolean;
  onSelectPeer: (peerId: string) => void;
  onSendMessage: (peerId: string, text: string) => boolean;
  onSendFile: (peerId: string, file: File) => Promise<any>;
  onCancelFileTransfer?: (peerId: string, fileId: string) => void;
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
  onSendFile,
  onCancelFileTransfer,
  onSendTypingIndicator,
  onDisconnectPeer,
  onOpenConnectModal,
}: ChatScreenProps) {
  const [inputText, setInputText] = useState("");
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [previewImageModal, setPreviewImageModal] = useState<{ url: string; name: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<any>(null);
  const dragCounterRef = useRef(0);

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

  // Trigger file browser
  const handlePaperclipClick = () => {
    if (!activePeer || activePeer.status !== "connected") {
      alert("Please connect to a device before sending files.");
      return;
    }
    fileInputRef.current?.click();
  };

  // Handle files selected via file dialog
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activePeer) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      await onSendFile(activePeer.deviceId, file);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      setIsDraggingOver(false);
      dragCounterRef.current = 0;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    dragCounterRef.current = 0;

    if (!activePeer || activePeer.status !== "connected") return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        await onSendFile(activePeer.deviceId, file);
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

  const getFileTypeIcon = (mimeType: string, filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    if (mimeType.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
      return <ImageIcon className="w-5 h-5 text-indigo-500" />;
    }
    if (mimeType.startsWith("video/") || ["mp4", "webm", "mkv", "mov", "avi"].includes(ext)) {
      return <Film className="w-5 h-5 text-purple-500" />;
    }
    if (mimeType.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "flac"].includes(ext)) {
      return <Music className="w-5 h-5 text-pink-500" />;
    }
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
      return <FileArchive className="w-5 h-5 text-amber-500" />;
    }
    if (["pdf"].includes(ext) || mimeType === "application/pdf") {
      return <FileText className="w-5 h-5 text-rose-500" />;
    }
    if (["xlsx", "xls", "csv"].includes(ext)) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
    }
    if (["js", "ts", "jsx", "tsx", "html", "css", "py", "json", "java", "c", "cpp"].includes(ext)) {
      return <FileCode className="w-5 h-5 text-cyan-500" />;
    }
    return <File className="w-5 h-5 text-slate-500" />;
  };

  const isImageFile = (fileItem: FileTransferItem) => {
    const ext = fileItem.name.split(".").pop()?.toLowerCase() || "";
    return fileItem.mimeType.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
  };

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-110px)] min-h-[480px] flex flex-col md:flex-row rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        multiple
        className="hidden"
      />

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
            className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-colors cursor-pointer"
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
                className="mt-2 block mx-auto text-indigo-600 dark:text-indigo-400 font-semibold hover:underline text-xs cursor-pointer"
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
        className={`flex-1 flex flex-col bg-white dark:bg-slate-900 relative ${
          !activePeer ? "hidden md:flex" : "flex"
        }`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag Overlay */}
        {isDraggingOver && (
          <div className="absolute inset-0 z-50 bg-indigo-600/90 backdrop-blur-xs flex flex-col items-center justify-center text-white p-6 border-4 border-dashed border-white/60 m-2 rounded-2xl animate-in fade-in duration-200">
            <UploadCloud className="w-16 h-16 mb-3 animate-bounce" />
            <h3 className="text-lg font-bold">Drop files here to share</h3>
            <p className="text-xs text-indigo-100 mt-1">
              Direct P2P binary chunked WebRTC transfer to {activePeer?.deviceName}
            </p>
          </div>
        )}

        {activePeer ? (
          <>
            {/* Chat Header */}
            <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => onSelectPeer("")}
                  className="md:hidden p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
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
                    <span>Direct WebRTC P2P</span>
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
                  className="flex items-center gap-1 py-1 px-2.5 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs font-semibold transition-colors cursor-pointer"
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
                  <p>Start a conversation or send a file to {activePeer.deviceName}.</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Use the paperclip button or drag & drop files here.
                  </p>
                </div>
              ) : (
                activeChatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col group ${msg.isMine ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-end gap-1.5 max-w-[88%] sm:max-w-[75%]">
                      {/* Message Bubble (Text or File) */}
                      {msg.type === "file" && msg.file ? (
                        <div
                          className={`relative p-3 rounded-2xl text-xs break-words shadow-2xs border transition-all ${
                            msg.isMine
                              ? "bg-indigo-600 text-white border-indigo-500 rounded-br-xs"
                              : "bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700/80 rounded-bl-xs"
                          }`}
                        >
                          {/* If Image and Ready, show preview thumbnail */}
                          {isImageFile(msg.file) && msg.file.url && (
                            <div className="mb-2.5 overflow-hidden rounded-xl bg-black/10">
                              <img
                                src={msg.file.url}
                                alt={msg.file.name}
                                className="max-h-56 max-w-full rounded-xl object-contain cursor-pointer hover:opacity-95 transition-opacity"
                                onClick={() =>
                                  setPreviewImageModal({
                                    url: msg.file!.url!,
                                    name: msg.file!.name,
                                  })
                                }
                              />
                            </div>
                          )}

                          {/* File info bar */}
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                msg.isMine
                                  ? "bg-white/20 text-white"
                                  : "bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700"
                              }`}
                            >
                              {getFileTypeIcon(msg.file.mimeType, msg.file.name)}
                            </div>

                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-xs truncate max-w-[180px] sm:max-w-[240px]">
                                {msg.file.name}
                              </h4>
                              <p
                                className={`text-[10px] font-mono mt-0.5 ${
                                  msg.isMine ? "text-indigo-100" : "text-slate-400"
                                }`}
                              >
                                {FileTransferService.formatFileSize(msg.file.size)}
                              </p>
                            </div>

                            {/* Download Action */}
                            {msg.file.status === "completed" && msg.file.url && (
                              <a
                                href={msg.file.url}
                                download={msg.file.name}
                                className={`p-2 rounded-xl flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer ${
                                  msg.isMine
                                    ? "bg-white/20 text-white hover:bg-white/30"
                                    : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
                                }`}
                                title={`Download ${msg.file.name}`}
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            )}

                            {/* Cancel Action if transferring */}
                            {msg.file.status === "transferring" && onCancelFileTransfer && (
                              <button
                                onClick={() => onCancelFileTransfer(activePeer.deviceId, msg.file!.id)}
                                className="p-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/40 transition-colors cursor-pointer"
                                title="Cancel file transfer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Progress bar if transferring */}
                          {msg.file.status === "transferring" && (
                            <div className="mt-2.5 space-y-1">
                              <div className="flex items-center justify-between text-[10px] font-mono">
                                <span>Transferring...</span>
                                <span>{msg.file.progress}%</span>
                              </div>
                              <div className="w-full bg-black/20 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-emerald-400 h-full rounded-full transition-all duration-150"
                                  style={{ width: `${msg.file.progress}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Cancelled status notice */}
                          {msg.file.status === "cancelled" && (
                            <p className="mt-1.5 text-[10px] text-amber-300 font-medium">
                              Transfer cancelled
                            </p>
                          )}

                          {/* Error status notice */}
                          {msg.file.status === "error" && (
                            <p className="mt-1.5 text-[10px] text-rose-300 font-medium">
                              Transfer failed
                            </p>
                          )}

                          {/* Footer info */}
                          <div
                            className={`mt-1 flex items-center justify-end gap-1 text-[9px] font-mono ${
                              msg.isMine ? "text-indigo-200" : "text-slate-400"
                            }`}
                          >
                            <span>{formatMessageTime(msg.timestamp)}</span>
                            {msg.isMine && (
                              <span>
                                {msg.file.status === "completed" && (
                                  <CheckCheck className="w-3 h-3 text-indigo-200" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Standard Text Message */
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
                      )}

                      {/* Copy message button (for text messages) */}
                      {msg.type !== "file" && (
                        <button
                          onClick={() => handleCopyMessage(msg.id, msg.text)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-opacity cursor-pointer"
                          title="Copy message"
                        >
                          {copiedMsgId === msg.id ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
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

            {/* Input Bar */}
            <div className="p-2.5 sm:p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex items-end gap-1.5">
                <button
                  id="attach-file-btn"
                  onClick={handlePaperclipClick}
                  className="p-2.5 rounded-xl text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Share file (Images, Docs, Media, Archives)"
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
                  className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-40 text-white shadow-xs transition-all cursor-pointer"
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 px-0.5">
                <span>Direct P2P File & Text Transfer</span>
                <span>Drag & drop files or click 📎</span>
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
              Choose a connected device from the sidebar or connect a new device to start messaging and sharing files.
            </p>
            <button
              onClick={onOpenConnectModal}
              className="mt-3.5 inline-flex items-center gap-1 py-1.5 px-3.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold shadow-xs hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect Device</span>
            </button>
          </div>
        )}
      </div>

      {/* Lightbox Image Preview Modal */}
      {previewImageModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewImageModal(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewImageModal(null)}
              className="absolute -top-10 right-0 p-1.5 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImageModal.url}
              alt={previewImageModal.name}
              className="max-h-[80vh] max-w-full rounded-xl object-contain shadow-2xl"
            />
            <div className="mt-3 flex items-center gap-3">
              <span className="text-xs text-white/80 font-medium truncate max-w-xs">
                {previewImageModal.name}
              </span>
              <a
                href={previewImageModal.url}
                download={previewImageModal.name}
                className="py-1 px-3 rounded-lg bg-indigo-600 text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-indigo-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
