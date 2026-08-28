import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Check,
  CheckCheck,
  Copy,
  Download,
  Eye,
  File,
  FileArchive,
  FileCode,
  FileSpreadsheet,
  FileText,
  Film,
  Image as ImageIcon,
  Laptop,
  MessageSquare,
  Mic,
  Music,
  Paperclip,
  Phone,
  Plus,
  Send,
  ShieldCheck,
  Smartphone,
  Square,
  Tablet,
  Trash2,
  Unplug,
  UploadCloud,
  X,
} from "lucide-react";
import { FileTransferService } from "../services/fileTransfer";
import { VoiceRecorderService } from "../services/voiceRecorder";
import { ChatMessage, ConnectedPeer, FileTransferItem } from "../types";
import { FilePreviewModal } from "./FilePreviewModal";
import { VoiceMessagePlayer } from "./VoiceMessagePlayer";

interface ChatScreenProps {
  peers: ConnectedPeer[];
  activePeer: ConnectedPeer | null;
  activeChatMessages: ChatMessage[];
  isTargetTyping: boolean;
  onSelectPeer: (peerId: string) => void;
  onSendMessage: (peerId: string, text: string) => boolean;
  onSendFile: (peerId: string, file: File) => Promise<any>;
  onSendVoiceMessage?: (peerId: string, blob: Blob, duration: number, waveform?: number[]) => Promise<any>;
  onStartVoiceCall?: (peerId: string) => void;
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
  onSendVoiceMessage,
  onStartVoiceCall,
  onCancelFileTransfer,
  onSendTypingIndicator,
  onDisconnectPeer,
  onOpenConnectModal,
}: ChatScreenProps) {
  const [inputText, setInputText] = useState("");
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileTransferItem | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [micVolume, setMicVolume] = useState(20);
  const voiceRecorderRef = useRef<VoiceRecorderService | null>(null);
  const recordIntervalRef = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<any>(null);
  const dragCounterRef = useRef(0);

  // Auto-scroll inside messages container without bouncing window on mobile
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
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

  // Voice Recording Handlers
  const handleStartRecording = async () => {
    if (!activePeer || activePeer.status !== "connected") {
      alert("Connect to a peer before recording voice messages.");
      return;
    }

    const recorder = new VoiceRecorderService();
    voiceRecorderRef.current = recorder;

    const success = await recorder.startRecording((vol) => {
      setMicVolume(vol);
    });

    if (success) {
      setIsRecording(true);
      setRecordDuration(0);
      recordIntervalRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    }
  };

  const handleStopAndSendVoice = async () => {
    if (!voiceRecorderRef.current || !activePeer) return;

    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }

    const result = await voiceRecorderRef.current.stopRecording();
    setIsRecording(false);
    setRecordDuration(0);

    if (result && onSendVoiceMessage) {
      await onSendVoiceMessage(
        activePeer.deviceId,
        result.blob,
        result.duration,
        result.waveformData
      );
    }
  };

  const handleCancelVoiceRecording = () => {
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    voiceRecorderRef.current?.cancelRecording();
    setIsRecording(false);
    setRecordDuration(0);
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
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
    if (["js", "ts", "jsx", "tsx", "html", "css", "py", "json", "java", "c", "cpp", "md", "txt", "sh", "sql"].includes(ext)) {
      return <FileCode className="w-5 h-5 text-cyan-500" />;
    }
    return <File className="w-5 h-5 text-slate-500" />;
  };

  const isImageFile = (fileItem: FileTransferItem) => {
    const ext = fileItem.name.split(".").pop()?.toLowerCase() || "";
    return fileItem.mimeType.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
  };

  const isVideoFile = (fileItem: FileTransferItem) => {
    const ext = fileItem.name.split(".").pop()?.toLowerCase() || "";
    return fileItem.mimeType.startsWith("video/") || ["mp4", "webm", "mov"].includes(ext);
  };

  return (
    <div className="w-full max-w-6xl mx-auto h-full md:h-[calc(100vh-130px)] md:min-h-[500px] flex flex-col md:flex-row md:rounded-2xl bg-white dark:bg-slate-900 border-0 md:border border-slate-200 dark:border-slate-800 shadow-none md:shadow-xs overflow-hidden min-h-0">
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
        className={`w-full md:w-72 border-r border-slate-200 dark:border-slate-800 flex flex-col min-h-0 bg-slate-50/50 dark:bg-slate-900/50 ${
          activePeer ? "hidden md:flex" : "flex flex-1"
        }`}
      >
        <div className="px-3.5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
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

        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1.5 space-y-0.5 touch-pan-y overscroll-contain webkit-overflow-touch">
          {peers.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
              <p>No connected peers</p>
              <p className="mt-1 text-[11px]">Click + to link a device with a 6-digit code</p>
            </div>
          ) : (
            peers.map((peer) => {
              const isSelected = activePeer?.deviceId === peer.deviceId;
              const isOnline = peer.status === "connected";

              return (
                <div
                  key={peer.deviceId}
                  onClick={() => onSelectPeer(peer.deviceId)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400"
                    }`}
                  >
                    {getDeviceIcon(peer)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4
                        className={`text-xs font-semibold truncate ${
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
        className={`flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-900 relative ${
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
            <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
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
              <div className="flex items-center gap-2">
                {/* Voice Call Button */}
                {activePeer.status === "connected" && onStartVoiceCall && (
                  <button
                    id="start-voice-call-header-btn"
                    onClick={() => onStartVoiceCall(activePeer.deviceId)}
                    className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer"
                    title="Start P2P Voice Call / ভয়েস কল"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Call</span>
                  </button>
                )}

                <button
                  onClick={() => onDisconnectPeer(activePeer.deviceId)}
                  className="flex items-center gap-1 py-1.5 px-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs font-semibold transition-colors cursor-pointer"
                  title="Disconnect Peer"
                >
                  <Unplug className="w-3 h-3" />
                  <span className="hidden sm:inline">Disconnect</span>
                </button>
              </div>
            </div>

            {/* Message Stream */}
            <div
              ref={messagesContainerRef}
              id="chat-messages-container"
              className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3 bg-slate-50/40 dark:bg-slate-950/30 touch-pan-y overscroll-contain webkit-overflow-touch"
            >
              {/* Privacy Notice Banner */}
              <div className="max-w-sm mx-auto rounded-lg bg-slate-100/80 dark:bg-slate-800/60 p-2 text-center text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5 border border-slate-200/60 dark:border-slate-700/60">
                <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                <span>Direct peer-to-peer WebRTC • Zero server logs</span>
              </div>

              {activeChatMessages.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  <p>Start a conversation or send a file to {activePeer.deviceName}.</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Use the paperclip for files, mic for voice notes, or phone for voice calling.
                  </p>
                </div>
              ) : (
                activeChatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col group ${msg.isMine ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-end gap-1.5 max-w-[90%] sm:max-w-[78%]">
                      {/* 1. Voice Message Bubble */}
                      {msg.type === "voice" && msg.voice ? (
                        <div
                          className={`relative p-3 rounded-2xl text-xs break-words shadow-2xs border transition-all ${
                            msg.isMine
                              ? "bg-indigo-600 text-white border-indigo-500 rounded-br-xs"
                              : "bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700/80 rounded-bl-xs"
                          }`}
                        >
                          <VoiceMessagePlayer voice={msg.voice} isMine={msg.isMine} />
                          <div
                            className={`mt-1 flex items-center justify-end gap-1 text-[9px] font-mono ${
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
                              </span>
                            )}
                          </div>
                        </div>
                      ) : msg.type === "file" && msg.file ? (
                        /* 2. File Transfer Bubble with WhatsApp-style In-App Preview */
                        <div
                          className={`relative p-3 rounded-2xl text-xs break-words shadow-2xs border transition-all ${
                            msg.isMine
                              ? "bg-indigo-600 text-white border-indigo-500 rounded-br-xs"
                              : "bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700/80 rounded-bl-xs"
                          }`}
                        >
                          {/* Image preview */}
                          {isImageFile(msg.file) && msg.file.url && (
                            <div
                              className="mb-2.5 overflow-hidden rounded-xl bg-black/10 cursor-pointer relative group/img"
                              onClick={() => setPreviewFile(msg.file!)}
                            >
                              <img
                                src={msg.file.url}
                                alt={msg.file.name}
                                className="max-h-56 max-w-full rounded-xl object-contain hover:opacity-95 transition-opacity"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity text-white gap-1 text-xs font-semibold">
                                <Eye className="w-4 h-4" />
                                <span>Preview</span>
                              </div>
                            </div>
                          )}

                          {/* Video player preview inline */}
                          {isVideoFile(msg.file) && msg.file.url && msg.file.status === "completed" && (
                            <div className="mb-2.5 overflow-hidden rounded-xl bg-black">
                              <video src={msg.file.url} controls className="max-h-56 max-w-full rounded-xl" />
                            </div>
                          )}

                          {/* File info bar */}
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 cursor-pointer ${
                                msg.isMine
                                  ? "bg-white/20 text-white hover:bg-white/30"
                                  : "bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 hover:bg-indigo-100"
                              }`}
                              onClick={() => msg.file?.status === "completed" && setPreviewFile(msg.file)}
                              title="Click to preview file in-app without downloading"
                            >
                              {getFileTypeIcon(msg.file.mimeType, msg.file.name)}
                            </div>

                            <div
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => msg.file?.status === "completed" && setPreviewFile(msg.file)}
                            >
                              <h4 className="font-semibold text-xs truncate max-w-[170px] sm:max-w-[220px] hover:underline">
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

                            {/* In-App WhatsApp-style Preview Button */}
                            {msg.file.status === "completed" && msg.file.url && (
                              <button
                                onClick={() => setPreviewFile(msg.file!)}
                                className={`p-2 rounded-xl flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer ${
                                  msg.isMine
                                    ? "bg-white/20 text-white hover:bg-white/30"
                                    : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
                                }`}
                                title="In-App Preview / প্রিভিউ দেখুন"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}

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
                        /* 3. Standard Text Message */
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
                      {msg.type !== "file" && msg.type !== "voice" && (
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

            {/* Input Bar / Voice Recorder Bar */}
            <div className="p-2.5 sm:p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              {isRecording ? (
                /* Live WhatsApp-style Voice Recording Bar */
                <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-2 animate-in fade-in duration-150">
                  {/* Blinking recording indicator & duration */}
                  <div className="flex items-center gap-2 px-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                    <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
                      {formatTimer(recordDuration)}
                    </span>
                  </div>

                  {/* Dynamic audio level visualization wave bars */}
                  <div className="flex-1 flex items-center justify-center gap-1 h-6 px-2">
                    {[20, 45, 75, 30, 90, 60, 40, 80, 50, 35, 70, 45].map((h, i) => (
                      <div
                        key={i}
                        className="w-1 bg-rose-500 rounded-full transition-all duration-100"
                        style={{
                          height: `${Math.max(4, (micVolume / 100) * h)}px`,
                        }}
                      />
                    ))}
                  </div>

                  {/* Cancel / Trash Recording */}
                  <button
                    onClick={handleCancelVoiceRecording}
                    className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors cursor-pointer"
                    title="Cancel recording"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Send Voice Note Button */}
                  <button
                    onClick={handleStopAndSendVoice}
                    className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs active:scale-95 transition-transform cursor-pointer"
                    title="Send Voice Message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                /* Standard Message Input Bar with Attach & Voice Record Buttons */
                <div className="flex items-end gap-1.5">
                  <button
                    id="attach-file-btn"
                    onClick={handlePaperclipClick}
                    className="p-2.5 rounded-xl text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Share file (Images, Docs, PDF, Media, Code)"
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
                      placeholder={`Message ${activePeer.deviceName}... (Enter to send)`}
                      rows={1}
                      className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none max-h-28 transition-all"
                    />
                  </div>

                  {inputText.trim() ? (
                    <button
                      id="send-message-btn"
                      onClick={handleSend}
                      className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-xs transition-all cursor-pointer"
                      title="Send message"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  ) : (
                    /* Microphone Voice Note Button (WhatsApp-style) */
                    <button
                      id="record-voice-btn"
                      onClick={handleStartRecording}
                      className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 transition-all active:scale-95 shadow-2xs cursor-pointer"
                      title="Record Voice Message / ভয়েস মেসেজ পাঠান"
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 px-0.5">
                <span>Direct P2P File & Voice Sharing</span>
                <span>Click 👁 to preview files without downloading</span>
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
              Choose a connected device from the sidebar or link a new device to start messaging, file sharing, voice notes, and voice calls.
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

      {/* In-App File Preview Modal (PDFs, Images, Videos, Code, Audio, etc.) */}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}
