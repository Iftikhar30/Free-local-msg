import { ChatMessage, DataPacket, FileTransferItem } from "../types";
import { playFileTransferCompleteSound } from "./sound";
import { WebRTCManager } from "./webrtc";

const CHUNK_SIZE = 16 * 1024; // 16 KB chunk size for smooth streaming

interface IncomingTransfer {
  fileId: string;
  name: string;
  size: number;
  mimeType: string;
  totalChunks: number;
  receivedChunks: Map<number, string>; // chunkIndex -> base64 data
  startTime: number;
  lastProgressUpdate: number;
}

export class FileTransferService {
  private webrtc: WebRTCManager;
  private myDeviceId: string;
  private myDeviceName: string;

  // Active incoming transfers: fileId -> IncomingTransfer
  private incomingTransfers = new Map<string, IncomingTransfer>();
  // Active outgoing transfers cancellation flags: fileId -> boolean
  private activeOutgoingTransfers = new Map<string, { cancelled: boolean }>();
  // Object URLs registry: fileId -> string (URL)
  private objectUrls = new Map<string, string>();

  private onFileProgressCallback?: (
    peerId: string,
    fileId: string,
    progress: number,
    status: FileTransferItem["status"],
    url?: string
  ) => void;

  private onFileReceivedCallback?: (peerId: string, message: ChatMessage) => void;

  constructor(
    webrtc: WebRTCManager,
    myDeviceId: string,
    myDeviceName: string,
    callbacks: {
      onFileProgress?: (
        peerId: string,
        fileId: string,
        progress: number,
        status: FileTransferItem["status"],
        url?: string
      ) => void;
      onFileReceived?: (peerId: string, message: ChatMessage) => void;
    }
  ) {
    this.webrtc = webrtc;
    this.myDeviceId = myDeviceId;
    this.myDeviceName = myDeviceName;
    this.onFileProgressCallback = callbacks.onFileProgress;
    this.onFileReceivedCallback = callbacks.onFileReceived;
  }

  public updateMyDeviceName(name: string) {
    this.myDeviceName = name;
  }

  public getObjectUrl(fileId: string): string | undefined {
    return this.objectUrls.get(fileId);
  }

  /**
   * Helper: Format bytes to human readable string
   */
  public static formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  /**
   * Helper: Convert ArrayBuffer slice to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Helper: Convert base64 back to Uint8Array
   */
  private base64ToUint8Array(base64: string): Uint8Array {
    const binary = attoaSafe(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Send file to peer with chunking and backpressure control
   */
  public async sendFile(
    toPeerId: string,
    file: File,
    onProgress?: (progress: number, speed: string) => void
  ): Promise<{ fileItem: FileTransferItem; messageId: string }> {
    const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const mimeType = file.type || "application/octet-stream";

    // Local object URL for instant preview / download
    const localUrl = URL.createObjectURL(file);
    this.objectUrls.set(fileId, localUrl);

    const fileItem: FileTransferItem = {
      id: fileId,
      name: file.name,
      size: file.size,
      mimeType,
      totalChunks,
      progress: 0,
      status: "transferring",
      url: localUrl,
      isMine: true,
    };

    const transferState = { cancelled: false };
    this.activeOutgoingTransfers.set(fileId, transferState);

    // 1. Send file_start packet
    const startPacket: DataPacket = {
      id: `start_${fileId}`,
      type: "file_start",
      timestamp: Date.now(),
      senderId: this.myDeviceId,
      senderName: this.myDeviceName,
      payload: {
        fileId,
        name: file.name,
        size: file.size,
        mimeType,
        totalChunks,
        chunkSize: CHUNK_SIZE,
      },
    };

    this.webrtc.sendDataPacket(toPeerId, startPacket);

    // 2. Start asynchronous chunk streaming
    (async () => {
      const startTime = Date.now();
      let sentBytes = 0;

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (transferState.cancelled) {
          this.activeOutgoingTransfers.delete(fileId);
          this.onFileProgressCallback?.(toPeerId, fileId, 0, "cancelled");
          return;
        }

        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(file.size, start + CHUNK_SIZE);
        const slice = file.slice(start, end);
        const arrayBuffer = await slice.arrayBuffer();
        const base64Data = this.arrayBufferToBase64(arrayBuffer);

        // Wait for WebRTC data channel buffer drain before sending next chunk
        await this.webrtc.waitForBufferDrain(toPeerId);

        const chunkPacket: DataPacket = {
          id: `chunk_${fileId}_${chunkIndex}`,
          type: "file_chunk",
          timestamp: Date.now(),
          senderId: this.myDeviceId,
          senderName: this.myDeviceName,
          payload: {
            fileId,
            chunkIndex,
            totalChunks,
            data: base64Data,
          },
        };

        this.webrtc.sendDataPacket(toPeerId, chunkPacket);

        sentBytes += (end - start);
        const progress = Math.min(100, Math.round((sentBytes / file.size) * 100));
        const elapsedSec = (Date.now() - startTime) / 1000;
        const speedBps = elapsedSec > 0 ? sentBytes / elapsedSec : 0;
        const speedFormatted = `${FileTransferService.formatFileSize(speedBps)}/s`;

        onProgress?.(progress, speedFormatted);
        this.onFileProgressCallback?.(toPeerId, fileId, progress, "transferring");
      }

      // 3. Send file_complete packet
      const completePacket: DataPacket = {
        id: `comp_${fileId}`,
        type: "file_complete",
        timestamp: Date.now(),
        senderId: this.myDeviceId,
        senderName: this.myDeviceName,
        payload: { fileId },
      };

      this.webrtc.sendDataPacket(toPeerId, completePacket);

      this.activeOutgoingTransfers.delete(fileId);
      this.onFileProgressCallback?.(toPeerId, fileId, 100, "completed", localUrl);
      playFileTransferCompleteSound();
    })().catch((err) => {
      console.error(`File transfer error for ${file.name}:`, err);
      this.activeOutgoingTransfers.delete(fileId);
      this.onFileProgressCallback?.(toPeerId, fileId, 0, "error");
    });

    return { fileItem, messageId: fileId };
  }

  /**
   * Cancel ongoing outgoing file transfer
   */
  public cancelTransfer(peerId: string, fileId: string) {
    const outgoing = this.activeOutgoingTransfers.get(fileId);
    if (outgoing) {
      outgoing.cancelled = true;
      this.activeOutgoingTransfers.delete(fileId);
    }

    if (this.incomingTransfers.has(fileId)) {
      this.incomingTransfers.delete(fileId);
    }

    this.webrtc.sendDataPacket(peerId, {
      id: `cancel_${fileId}`,
      type: "file_cancel",
      timestamp: Date.now(),
      senderId: this.myDeviceId,
      senderName: this.myDeviceName,
      payload: { fileId },
    });

    this.onFileProgressCallback?.(peerId, fileId, 0, "cancelled");
  }

  /**
   * Handle incoming file transfer packets
   */
  public handleFilePacket(peerId: string, packet: DataPacket) {
    switch (packet.type) {
      case "file_start": {
        const { fileId, name, size, mimeType, totalChunks } = packet.payload;
        this.incomingTransfers.set(fileId, {
          fileId,
          name,
          size,
          mimeType,
          totalChunks,
          receivedChunks: new Map<number, string>(),
          startTime: Date.now(),
          lastProgressUpdate: Date.now(),
        });

        const incomingMsg: ChatMessage = {
          id: fileId,
          fromDeviceId: packet.senderId,
          toDeviceId: this.myDeviceId,
          text: `Sent a file: ${name}`,
          timestamp: packet.timestamp,
          status: "delivered",
          isMine: false,
          type: "file",
          file: {
            id: fileId,
            name,
            size,
            mimeType,
            totalChunks,
            progress: 0,
            status: "transferring",
            isMine: false,
          },
        };

        this.onFileReceivedCallback?.(peerId, incomingMsg);
        break;
      }

      case "file_chunk": {
        const { fileId, chunkIndex, data } = packet.payload;
        const transfer = this.incomingTransfers.get(fileId);
        if (!transfer) return;

        transfer.receivedChunks.set(chunkIndex, data);
        const progress = Math.min(
          99,
          Math.round((transfer.receivedChunks.size / transfer.totalChunks) * 100)
        );

        // Throttle UI progress update every 100ms
        const now = Date.now();
        if (now - transfer.lastProgressUpdate > 100 || progress === 99) {
          transfer.lastProgressUpdate = now;
          this.onFileProgressCallback?.(peerId, fileId, progress, "transferring");
        }
        break;
      }

      case "file_complete": {
        const { fileId } = packet.payload;
        const transfer = this.incomingTransfers.get(fileId);
        if (!transfer) return;

        // Assemble chunks in order
        const parts: Uint8Array[] = [];
        for (let i = 0; i < transfer.totalChunks; i++) {
          const chunkBase64 = transfer.receivedChunks.get(i);
          if (chunkBase64) {
            parts.push(this.base64ToUint8Array(chunkBase64));
          }
        }

        const blob = new Blob(parts, { type: transfer.mimeType });
        const blobUrl = URL.createObjectURL(blob);
        this.objectUrls.set(fileId, blobUrl);

        this.incomingTransfers.delete(fileId);

        this.onFileProgressCallback?.(peerId, fileId, 100, "completed", blobUrl);
        playFileTransferCompleteSound();
        break;
      }

      case "file_cancel": {
        const { fileId } = packet.payload;
        this.incomingTransfers.delete(fileId);
        this.onFileProgressCallback?.(peerId, fileId, 0, "cancelled");
        break;
      }
    }
  }
}

function attoaSafe(base64: string): string {
  try {
    return atob(base64);
  } catch (e) {
    console.error("Failed to decode base64:", e);
    return "";
  }
}
