import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDown,
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

  // Scroll management state
  const [showNewMessagesBtn, setShowNewMessagesBtn] = useState(false);
  const [unreadBelowCount, setUnreadBelowCount] = useState(0);
  const isNearBottomRef = useRef(true);
  const prevMessagesLengthRef = useRef(activeChatMessages.length);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [micVolume, setMicVolume] = useState(20);
  const voiceRecorderRef = useRef<VoiceRecorderService | null>(null);
  const recordIntervalRef = useRef<any>(null);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<any>(null);
  const dragCounterRef = useRef(0);

  // Helper to scroll messages container to bottom
  const scrollToBottom = (smooth = true) => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      if (smooth) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth",
        });
      } else {
        container.scrollTop = container.scrollHeight;
      }
      isNearBottomRef.current = true;
      setShowNewMessagesBtn(false);
      setUnreadBelowCount(0);
    }
  };

  // Scroll event handler for message container
  const handleMessagesScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, clientHeight, scrollHeight } = messagesContainerRef.current;
    // User is near bottom if within 80px of bottom boundary
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 80;
    isNearBottomRef.current = isAtBottom;

    if (isAtBottom) {
      setShowNewMessagesBtn(false);
      setUnreadBelowCount(0);
    }
  };

  // Auto-scroll inside messages container when new messages arrive
  useEffect(() => {
    const isNewMsgAdded = activeChatMessages.length > prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = activeChatMessages.length;

    if (activeChatMessages.length === 0) return;

    const lastMsg = activeChatMessages[activeChatMessages.length - 1];

    // Scroll down if user sent the message or is already at bottom
    if (lastMsg?.isMine || isNearBottomRef.current) {
      scrollToBottom(true);
    } else if (isNewMsgAdded) {
      // User is scrolled up reading old history -> show "New messages" indicator
      setShowNewMessagesBtn(true);
      setUnreadBelowCount((prev) => prev + 1);
    }
  }, [activeChatMessages, isTargetTyping]);

  // Initial load / switching peers scrolls to bottom immediately
  useEffect(() => {
    if (activePeer) {
      requestAnimationFrame(() => {
        scrollToBottom(false);
      });
    }
  }, [activePeer?.deviceId]);

  // Adjust input textarea height dynamically (max 5-6 lines on mobile, 7 lines on desktop)
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
    const maxHeight = isMobile ? 120 : 160;

    const scrollH = textarea.scrollHeight;
    if (scrollH > maxHeight) {
      textarea.style.height = `${maxHeight}px`;
      textarea.style.overflowY = "auto";
    } else {
      textarea.style.height = `${scrollH}px`;
      textarea.style.overflowY = "hidden";
    }
  };

  // Handle typing debounce & dynamic resize
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);
    adjustTextareaHeight();

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

      // Reset textarea height & preserve focus
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.overflowY = "hidden";
        textareaRef.current.focus();
      }

      // Smooth scroll to bottom after send
      setTimeout(() => scrollToBottom(true), 40);
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
      alert("Please connect to a device before sending voice notes.");
      return;
    }

    try {
      const recorder = new VoiceRecorderService();
      await recorder.startRecording((volume) => {
        setMicVolume(volume);
      });

      voiceRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordDuration(0);

      recordIntervalRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Failed to start voice recording:", err);
      alert("Microphone access is required to record voice notes.");
    }
  };

  const handleStopAndSendVoice = async () => {
    if (!voiceRecorderRef.current || !activePeer || !onSendVoiceMessage) return;

    try {
      const { blob, duration, waveform } = await voiceRecorderRef.current.stopRecording();
      clearInterval(recordIntervalRef.current);
      setIsRecording(false);
      setRecordDuration(0);
      voiceRecorderRef.current = null;

      if (duration < 1) {
        return; // ignore accidental micro taps
      }

      await onSendVoiceMessage(activePeer.deviceId, blob, duration, waveform);
      setTimeout(() => scrollToBottom(true), 50);
    } catch (err) {
      console.error("Failed to stop and send voice message:", err);
      setIsRecording(false);
    }
  };

  const handleCancelVoiceRecording = () => {
    if (voiceRecorderRef.current) {
      voiceRecorderRef.current.cancelRecording();
      voiceRecorderRef.current = null;
    }
    clearInterval(recordIntervalRef.current);
    setIsRecording(false);
    setRecordDuration(0);
  };

  // Copy text message to clipboard
  const handleCopyMessage = (msgId: string, text?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  // Drag and Drop File Handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDraggingOver(false);
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

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        await onSendFile(activePeer.deviceId, files[i]);
      }
    }
  };

  // Format device icon
  const getDeviceIcon = (peer: ConnectedPeer) => {
    switch (peer.deviceType) {
      case "phone":
        return <Smartphone className="w-4 h-4" />;
      case "tablet":
        return <Tablet className="w-4 h-4" />;
      default:
        return <Laptop className="w-4 h-4" />;
    }
  };

  // Format timestamp (e.g., 10:32 PM)
  const formatMessageTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Format recording timer (e.g., 0:05)
  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getFileTypeIcon = (mimeType?: string, fileName?: string) => {
    const ext = fileName?.split(".").pop()?.toLowerCase() || "";
    if (mimeType?.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
      return <ImageIcon className="w-4 h-4 text-emerald-500" />;
    }
    if (mimeType?.startsWith("video/") || ["mp4", "webm", "mkv", "mov"].includes(ext)) {
      return <Film className="w-4 h-4 text-indigo-500" />;
    }
    if (mimeType?.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a"].includes(ext)) {
      return <Music className="w-4 h-4 text-amber-500" />;
    }
    if (mimeType?.includes("pdf") || ext === "pdf") {
      return <FileText className="w-4 h-4 text-rose-500" />;
    }
    if (mimeType?.includes("zip") || mimeType?.includes("tar") || ["zip", "rar", "7z", "gz"].includes(ext)) {
      return <FileArchive className="w-4 h-4 text-amber-600" />;
    }
    if (["js", "ts", "tsx", "jsx", "json", "html", "css", "py", "java", "c", "cpp"].includes(ext)) {
      return <FileCode className="w-4 h-4 text-cyan-500" />;
    }
    if (["xls", "xlsx", "csv"].includes(ext)) {
      return <FileSpreadsheet className="w-4 h-4 text-emerald-600" />;
    }
    return <File className="w-4 h-4 text-slate-500" />;
  };

  const isImageFile = (file?: FileTransferItem) => {
    if (!file) return false;
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    return file.mimeType.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
  };

  const isVideoFile = (file?: FileTransferItem) => {
    if (!file) return false;
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    return file.mimeType.startsWith("video/") || ["mp4", "webm", "mkv", "mov"].includes(ext);
  };

  return (
    <div className="w-full max-w-6xl mx-auto h-full md:h-[calc(100vh-130px)] md:min-h-[520px] flex flex-col md:flex-row md:rounded-2xl bg-white dark:bg-slate-900 border-0 md:border border-slate-200 dark:border-slate-800 shadow-none md:shadow-xs overflow-hidden min-h-0">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        className="hidden"
        multiple
      />

      {/* Sidebar: Peer List */}
      <div
        className={`w-full md:w-72 border-r border-slate-200 dark:border-slate-800 flex flex-col min-h-0 bg-slate-50/50 dark:bg-slate-900/50 ${
          activePeer ? "hidden md:flex" : "flex flex-1"
        }`}
      >
        <div className="px-3.5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white">
              Conversations
            </h2>
          </div>
          <button
            onClick={onOpenConnectModal}
            className="p-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors cursor-pointer"
            title="Connect new device"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1.5 space-y-0.5 touch-pan-y overscroll-contain webkit-overflow-touch">
          {peers.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
              <p>No connected peers</p>
              <button
                onClick={onOpenConnectModal}
                className="mt-2 text-indigo-600 dark:text-indigo-400 font-medium underline cursor-pointer"
              >
                Link a device
              </button>
            </div>
          ) : (
            peers.map((peer) => {
              const isActive = activePeer?.deviceId === peer.deviceId;
              return (
                <div
                  key={peer.deviceId}
                  onClick={() => onSelectPeer(peer.deviceId)}
                  className={`w-full p-2.5 rounded-xl text-left flex items-center gap-3 transition-colors cursor-pointer ${
                    isActive
                      ? "bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/80 dark:border-indigo-800/80"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs">
                      {getDeviceIcon(peer)}
                    </div>
                    <span
                      className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
                        peer.status === "connected" ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                        {peer.deviceName}
                      </h4>
                      {peer.unreadCount ? (
                        <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[9px] font-bold">
                          {peer.unreadCount}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                      {peer.status === "connected" ? "🟢 Online" : "🟠 Reconnecting..."}
                    </p>
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
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag and drop overlay */}
        {isDraggingOver && (
          <div className="absolute inset-0 z-50 bg-indigo-600/90 dark:bg-indigo-900/90 backdrop-blur-xs flex flex-col items-center justify-center text-white border-2 border-dashed border-indigo-200 animate-in fade-in duration-150">
            <UploadCloud className="w-12 h-12 mb-2 animate-bounce" />
            <h3 className="text-base font-bold">Drop files here to send</h3>
            <p className="text-xs text-indigo-100 mt-0.5">
              Files will be sent directly to {activePeer?.deviceName} via P2P
            </p>
          </div>
        )}

        {activePeer ? (
          <>
            {/* WhatsApp-style Compact Header */}
            <div className="px-3 py-2 sm:px-4 sm:py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0 z-10 shadow-2xs">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <button
                  onClick={() => onSelectPeer("")}
                  className="md:hidden p-1.5 -ml-1 rounded-full text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Back to conversations"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <div className="relative shrink-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shadow-2xs border border-indigo-200/50 dark:border-indigo-800/50">
                    {getDeviceIcon(activePeer)}
                  </div>
                  <span
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
                      activePeer.status === "connected" ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
                    }`}
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate max-w-[140px] sm:max-w-[200px]">
                      {activePeer.deviceName}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                    <span
                      className={`font-medium ${
                        activePeer.status === "connected"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-500"
                      }`}
                    >
                      {activePeer.status === "connected" ? "🟢 Connected" : "🟠 Reconnecting..."}
                    </span>
                    {activePeer.latencyMs !== undefined && activePeer.status === "connected" && (
                      <span className="flex items-center gap-0.5 text-slate-400 font-mono text-[9px] border-l border-slate-200 dark:border-slate-800 pl-1.5">
                        <Activity className="w-2.5 h-2.5 text-emerald-500" />
                        {activePeer.latencyMs}ms
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Chat Header Actions */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {activePeer.status === "connected" && onStartVoiceCall && (
                  <button
                    id="start-voice-call-header-btn"
                    onClick={() => onStartVoiceCall(activePeer.deviceId)}
                    className="flex items-center gap-1.5 py-1.5 px-3 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer"
                    title="Start P2P Voice Call"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="hidden sm:inline">Call</span>
                  </button>
                )}

                <button
                  onClick={() => onDisconnectPeer(activePeer.deviceId)}
                  className="p-1.5 sm:py-1.5 sm:px-2.5 rounded-full border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-colors cursor-pointer"
                  title="Disconnect Peer"
                >
                  <Unplug className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline ml-1">Disconnect</span>
                </button>
              </div>
            </div>

            {/* Message Stream */}
            <div
              ref={messagesContainerRef}
              onScroll={handleMessagesScroll}
              id="chat-messages-container"
              className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3 bg-slate-50/40 dark:bg-slate-950/30 touch-pan-y overscroll-contain webkit-overflow-touch relative"
            >
              {/* Privacy Notice Banner */}
              <div className="max-w-sm mx-auto rounded-full bg-slate-100/90 dark:bg-slate-800/80 px-3 py-1 text-center text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs">
                <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                <span>Direct peer-to-peer WebRTC • Zero server logs</span>
              </div>

              {activeChatMessages.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  <p>Start a conversation or send a file to {activePeer.deviceName}.</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Use paperclip for files, mic for voice notes, or phone for voice call.
                  </p>
                </div>
              ) : (
                activeChatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col group ${msg.isMine ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-end gap-1.5 max-w-[85%] sm:max-w-[75%]">
                      {/* 1. Voice Message Bubble */}
                      {msg.type === "voice" && msg.voice ? (
                        <div
                          className={`relative p-3 rounded-2xl text-xs sm:text-sm break-words shadow-2xs border transition-all ${
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
                          className={`relative p-3 rounded-2xl text-xs sm:text-sm break-words shadow-2xs border transition-all ${
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
                                title="In-App Preview"
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
                          className={`relative px-3.5 py-2 rounded-2xl text-xs sm:text-sm break-words shadow-2xs ${
                            msg.isMine
                              ? "bg-indigo-600 text-white rounded-br-xs border border-indigo-500/80"
                              : "bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200/80 dark:border-slate-700/80 rounded-bl-xs"
                          }`}
                        >
                          <p className="whitespace-pre-wrap leading-relaxed select-text">{msg.text}</p>

                          {/* Footer info: time & delivery status */}
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
                                    className={`w-3.5 h-3.5 ${
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

                      {/* Copy message button */}
                      {msg.type !== "file" && msg.type !== "voice" && (
                        <button
                          onClick={() => handleCopyMessage(msg.id, msg.text)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-opacity cursor-pointer shrink-0"
                          title="Copy message"
                        >
                          {copiedMsgId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}

              {/* Peer typing indicator */}
              {isTargetTyping && (
                <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 animate-pulse font-medium py-1 px-2 rounded-full bg-indigo-50/50 dark:bg-indigo-950/40 w-max">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <span>{activePeer.deviceName} is typing...</span>
                </div>
              )}
            </div>

            {/* Floating "New Messages" Indicator / Button */}
            {showNewMessagesBtn && (
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20">
                <button
                  onClick={() => scrollToBottom(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-600 text-white text-xs font-semibold shadow-lg hover:bg-indigo-700 active:scale-95 transition-all animate-bounce cursor-pointer border border-indigo-400/40"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                  <span>New messages {unreadBelowCount > 0 ? `(${unreadBelowCount})` : ""}</span>
                </button>
              </div>
            )}

            {/* Input Bar / Voice Recorder Bar */}
            <div className="p-2 sm:p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
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
                    className="p-2 rounded-full text-slate-500 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors cursor-pointer"
                    title="Cancel recording"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Send Voice Note Button */}
                  <button
                    onClick={handleStopAndSendVoice}
                    className="p-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs active:scale-95 transition-transform cursor-pointer"
                    title="Send Voice Message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                /* WhatsApp-style Auto-Expanding Text Input Bar */
                <div className="flex items-end gap-2">
                  <button
                    id="attach-file-btn"
                    onClick={handlePaperclipClick}
                    className="p-2.5 rounded-full text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                    title="Share file (Images, Docs, PDF, Media, Code)"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>

                  <div className="flex-1 relative bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 focus-within:border-indigo-500 focus-within:bg-white dark:focus-within:bg-slate-900 transition-all flex items-center px-3 py-1.5 min-h-[42px]">
                    <textarea
                      id="chat-message-input"
                      ref={textareaRef}
                      value={inputText}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      placeholder={`Message ${activePeer.deviceName}...`}
                      rows={1}
                      className="w-full resize-none bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none transition-all py-1"
                      style={{ height: "auto", overflowY: "hidden" }}
                    />
                  </div>

                  {inputText.trim() ? (
                    <button
                      id="send-message-btn"
                      onClick={handleSend}
                      className="p-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-md transition-all cursor-pointer shrink-0"
                      title="Send message"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  ) : (
                    /* Voice Note Button when input is empty */
                    <button
                      id="record-voice-btn"
                      onClick={handleStartRecording}
                      className="p-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-md transition-all cursor-pointer shrink-0"
                      title="Record Voice Message / ভয়েস মেসেজ পাঠাও"
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 px-1">
                <span>Encrypted P2P Messaging & File Sharing</span>
                <span className="hidden sm:inline">Enter to send • Shift+Enter for new line</span>
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
