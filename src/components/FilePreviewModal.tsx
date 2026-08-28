import React, { useEffect, useState } from "react";
import {
  Code,
  Copy,
  Download,
  ExternalLink,
  Eye,
  File,
  FileArchive,
  FileCode,
  FileSpreadsheet,
  FileText,
  Film,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  Music,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { FileTransferService } from "../services/fileTransfer";
import { FileTransferItem } from "../types";

interface FilePreviewModalProps {
  file: FileTransferItem;
  onClose: () => void;
}

export function FilePreviewModal({ file, onClose }: FilePreviewModalProps) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [copiedText, setCopiedText] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const isImage = file.mimeType.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
  const isPdf = file.mimeType === "application/pdf" || ext === "pdf";
  const isVideo = file.mimeType.startsWith("video/") || ["mp4", "webm", "ogg", "mov"].includes(ext);
  const isAudio = file.mimeType.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "aac"].includes(ext);
  const isTextOrCode =
    file.mimeType.startsWith("text/") ||
    file.mimeType.includes("json") ||
    file.mimeType.includes("javascript") ||
    [
      "txt",
      "json",
      "js",
      "ts",
      "jsx",
      "tsx",
      "html",
      "css",
      "py",
      "md",
      "csv",
      "xml",
      "yaml",
      "yml",
      "log",
      "sql",
      "sh",
      "env",
    ].includes(ext);

  // Fetch text content for text/code preview if URL exists
  useEffect(() => {
    if (isTextOrCode && file.url && !textContent) {
      setLoadingText(true);
      fetch(file.url)
        .then((res) => res.text())
        .then((text) => {
          setTextContent(text);
          setLoadingText(false);
        })
        .catch((err) => {
          console.warn("Failed to load text file content for preview:", err);
          setLoadingText(false);
        });
    }
  }, [file.url, isTextOrCode, textContent]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleCopy = () => {
    if (textContent) {
      navigator.clipboard.writeText(textContent);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  const getIcon = () => {
    if (isImage) return <ImageIcon className="w-4 h-4 text-indigo-500" />;
    if (isPdf) return <FileText className="w-4 h-4 text-rose-500" />;
    if (isVideo) return <Film className="w-4 h-4 text-purple-500" />;
    if (isAudio) return <Music className="w-4 h-4 text-pink-500" />;
    if (isTextOrCode) return <FileCode className="w-4 h-4 text-cyan-500" />;
    return <File className="w-4 h-4 text-slate-500" />;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden transition-all duration-200 ${
          isFullscreen
            ? "w-full h-full rounded-none"
            : "w-full max-w-4xl h-[85vh] max-h-[850px]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0">
              {getIcon()}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md">
                {file.name}
              </h3>
              <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                {FileTransferService.formatFileSize(file.size)} • In-App Preview
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Image zoom & rotate controls */}
            {isImage && (
              <div className="flex items-center gap-1 mr-1 bg-slate-200/60 dark:bg-slate-800 rounded-lg p-0.5">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                  className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-mono px-1 text-slate-600 dark:text-slate-300">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                  className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  title="Rotate"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Text Copy control */}
            {isTextOrCode && textContent && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                title="Copy Content"
              >
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{copiedText ? "Copied!" : "Copy"}</span>
              </button>
            )}

            {/* Fullscreen Toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Open In New Tab */}
            {file.url && (
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Open in new window"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            {/* Download Button */}
            {file.url && (
              <a
                href={file.url}
                download={file.name}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                title="Download file"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Save</span>
              </a>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close Preview (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="flex-1 overflow-auto bg-slate-100/70 dark:bg-slate-950 flex items-center justify-center p-3 relative select-text">
          {/* 1. PDF Preview */}
          {isPdf ? (
            file.url ? (
              <iframe
                src={`${file.url}#toolbar=1&navpanes=0`}
                title={file.name}
                className="w-full h-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white"
              />
            ) : (
              <div className="text-center text-slate-400 text-xs">PDF file URL unavailable</div>
            )
          ) : isImage ? (
            /* 2. Image Preview */
            file.url ? (
              <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
                <img
                  src={file.url}
                  alt={file.name}
                  style={{
                    transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                    transition: "transform 0.15s ease-out",
                  }}
                  className="max-h-full max-w-full object-contain rounded-lg shadow-md"
                />
              </div>
            ) : (
              <div className="text-center text-slate-400 text-xs">Image unavailable</div>
            )
          ) : isVideo ? (
            /* 3. Video Preview */
            file.url ? (
              <div className="w-full h-full flex items-center justify-center p-2">
                <video
                  src={file.url}
                  controls
                  autoPlay
                  className="max-h-full max-w-full rounded-xl shadow-lg bg-black"
                />
              </div>
            ) : (
              <div className="text-center text-slate-400 text-xs">Video unavailable</div>
            )
          ) : isAudio ? (
            /* 4. Audio Preview */
            file.url ? (
              <div className="flex flex-col items-center justify-center p-8 max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl">
                <div className="w-20 h-20 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
                  <Music className="w-10 h-10 animate-pulse" />
                </div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white text-center mb-1 truncate max-w-xs">
                  {file.name}
                </h4>
                <p className="text-xs font-mono text-slate-400 mb-6">
                  {FileTransferService.formatFileSize(file.size)}
                </p>
                <audio src={file.url} controls autoPlay className="w-full" />
              </div>
            ) : (
              <div className="text-center text-slate-400 text-xs">Audio unavailable</div>
            )
          ) : isTextOrCode ? (
            /* 5. Text / Code Preview */
            <div className="w-full h-full flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-inner">
              <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>FORMAT: {ext.toUpperCase() || "TEXT"}</span>
                {textContent && (
                  <span>
                    {textContent.split("\n").length} lines • {textContent.length} chars
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-auto p-4 font-mono text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre font-normal selection:bg-indigo-500 selection:text-white">
                {loadingText ? (
                  <div className="flex items-center justify-center h-full text-slate-400">
                    Loading content...
                  </div>
                ) : textContent !== null ? (
                  textContent
                ) : (
                  <div className="text-slate-400">No content available to preview</div>
                )}
              </div>
            </div>
          ) : (
            /* 6. Generic File Card */
            <div className="flex flex-col items-center justify-center p-8 max-w-sm w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center mb-3">
                <File className="w-8 h-8" />
              </div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1 truncate max-w-xs">
                {file.name}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                {FileTransferService.formatFileSize(file.size)}
              </p>
              <p className="text-[10px] font-mono text-slate-400 mb-5">{file.mimeType}</p>
              {file.url && (
                <a
                  href={file.url}
                  download={file.name}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download File</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
