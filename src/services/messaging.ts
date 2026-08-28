import { ChatMessage, DataPacket, FileTransferItem } from "../types";
import { FileTransferService } from "./fileTransfer";
import { WebRTCManager } from "./webrtc";

const CHAT_STORAGE_PREFIX = "locallink_chat_";

export class MessagingService {
  private webrtc: WebRTCManager;
  private myDeviceId: string;
  private myDeviceName: string;
  private fileTransfer: FileTransferService;
  private onMessageReceivedCallback?: (msg: ChatMessage) => void;
  private onMessageStatusUpdatedCallback?: (msgId: string, status: ChatMessage["status"]) => void;
  private onTypingStateCallback?: (peerId: string, isTyping: boolean) => void;
  private onFileProgressUpdatedCallback?: (
    peerId: string,
    fileId: string,
    progress: number,
    status: FileTransferItem["status"],
    url?: string
  ) => void;

  constructor(
    webrtc: WebRTCManager,
    myDeviceId: string,
    myDeviceName: string,
    callbacks: {
      onMessageReceived?: (msg: ChatMessage) => void;
      onMessageStatusUpdated?: (msgId: string, status: ChatMessage["status"]) => void;
      onTypingState?: (peerId: string, isTyping: boolean) => void;
      onFileProgressUpdated?: (
        peerId: string,
        fileId: string,
        progress: number,
        status: FileTransferItem["status"],
        url?: string
      ) => void;
    }
  ) {
    this.webrtc = webrtc;
    this.myDeviceId = myDeviceId;
    this.myDeviceName = myDeviceName;
    this.onMessageReceivedCallback = callbacks.onMessageReceived;
    this.onMessageStatusUpdatedCallback = callbacks.onMessageStatusUpdated;
    this.onTypingStateCallback = callbacks.onTypingState;
    this.onFileProgressUpdatedCallback = callbacks.onFileProgressUpdated;

    this.fileTransfer = new FileTransferService(webrtc, myDeviceId, myDeviceName, {
      onFileProgress: (peerId, fileId, progress, status, url) => {
        this.updateFileProgressInHistory(peerId, fileId, progress, status, url);
        if (this.onFileProgressUpdatedCallback) {
          this.onFileProgressUpdatedCallback(peerId, fileId, progress, status, url);
        }
      },
      onFileReceived: (peerId, msg) => {
        this.saveMessageToHistory(peerId, msg);
        if (this.onMessageReceivedCallback) {
          this.onMessageReceivedCallback(msg);
        }
      },
    });
  }

  public updateMyDeviceName(name: string) {
    this.myDeviceName = name;
    this.fileTransfer.updateMyDeviceName(name);
  }

  /**
   * Primary abstraction: Send a text message to a specific peer over direct WebRTC DataChannel
   */
  public sendMessage(toPeerId: string, text: string): ChatMessage {
    const trimmed = text.trim();
    if (!trimmed) throw new Error("Message cannot be empty");

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = Date.now();

    const chatMsg: ChatMessage = {
      id: msgId,
      fromDeviceId: this.myDeviceId,
      toDeviceId: toPeerId,
      text: trimmed,
      timestamp,
      status: "sending",
      isMine: true,
      type: "text",
    };

    // Save to local device storage
    this.saveMessageToHistory(toPeerId, chatMsg);

    const packet: DataPacket = {
      id: msgId,
      type: "text",
      timestamp,
      senderId: this.myDeviceId,
      senderName: this.myDeviceName,
      payload: {
        text: trimmed,
      },
    };

    const sent = this.webrtc.sendDataPacket(toPeerId, packet);
    if (sent) {
      chatMsg.status = "sent";
      this.updateMessageStatusInHistory(toPeerId, msgId, "sent");
    } else {
      chatMsg.status = "failed";
      this.updateMessageStatusInHistory(toPeerId, msgId, "failed");
    }

    return chatMsg;
  }

  /**
   * Send a file to peer over direct WebRTC DataChannel with chunking
   */
  public async sendFile(
    toPeerId: string,
    file: File,
    onProgress?: (progress: number, speed: string) => void
  ): Promise<ChatMessage> {
    const { fileItem, messageId } = await this.fileTransfer.sendFile(toPeerId, file, file.name, undefined, onProgress);

    const chatMsg: ChatMessage = {
      id: messageId,
      fromDeviceId: this.myDeviceId,
      toDeviceId: toPeerId,
      text: `Sent a file: ${file.name}`,
      timestamp: Date.now(),
      status: "sent",
      isMine: true,
      type: "file",
      file: fileItem,
    };

    this.saveMessageToHistory(toPeerId, chatMsg);
    return chatMsg;
  }

  /**
   * Send a voice message note to peer over WebRTC
   */
  public async sendVoiceMessage(
    toPeerId: string,
    audioBlob: Blob,
    duration: number,
    waveformData?: number[]
  ): Promise<ChatMessage> {
    const filename = `voice_note_${Date.now()}.webm`;
    const { fileItem, messageId } = await this.fileTransfer.sendFile(
      toPeerId,
      audioBlob,
      filename,
      { isVoice: true, duration, waveformData }
    );

    const chatMsg: ChatMessage = {
      id: messageId,
      fromDeviceId: this.myDeviceId,
      toDeviceId: toPeerId,
      text: "Voice message",
      timestamp: Date.now(),
      status: "sent",
      isMine: true,
      type: "voice",
      voice: {
        id: messageId,
        url: fileItem.url || "",
        duration,
        mimeType: audioBlob.type || "audio/webm",
        size: audioBlob.size,
        waveformData,
      },
    };

    this.saveMessageToHistory(toPeerId, chatMsg);
    return chatMsg;
  }

  public cancelFileTransfer(peerId: string, fileId: string) {
    this.fileTransfer.cancelTransfer(peerId, fileId);
    this.updateFileProgressInHistory(peerId, fileId, 0, "cancelled");
  }

  public getFileObjectUrl(fileId: string): string | undefined {
    return this.fileTransfer.getObjectUrl(fileId);
  }

  /**
   * Primary abstraction: Handle incoming data packet and route to receiveMessage or acks
   */
  public handleIncomingPacket(peerId: string, packet: DataPacket) {
    switch (packet.type) {
      case "text": {
        const incomingMsg: ChatMessage = {
          id: packet.id,
          fromDeviceId: packet.senderId,
          toDeviceId: this.myDeviceId,
          text: packet.payload.text,
          timestamp: packet.timestamp,
          status: "delivered",
          isMine: false,
          type: "text",
        };

        this.saveMessageToHistory(peerId, incomingMsg);

        // Send delivery ACK back to sender over WebRTC DataChannel
        this.sendDeliveryAck(peerId, packet.id);

        if (this.onMessageReceivedCallback) {
          this.onMessageReceivedCallback(incomingMsg);
        }
        break;
      }

      case "delivery_ack": {
        const ackMsgId = packet.payload.messageId;
        this.updateMessageStatusInHistory(peerId, ackMsgId, "delivered");
        if (this.onMessageStatusUpdatedCallback) {
          this.onMessageStatusUpdatedCallback(ackMsgId, "delivered");
        }
        break;
      }

      case "read_ack": {
        const readMsgId = packet.payload.messageId;
        this.updateMessageStatusInHistory(peerId, readMsgId, "read");
        if (this.onMessageStatusUpdatedCallback) {
          this.onMessageStatusUpdatedCallback(readMsgId, "read");
        }
        break;
      }

      case "typing": {
        if (this.onTypingStateCallback) {
          this.onTypingStateCallback(peerId, !!packet.payload.isTyping);
        }
        break;
      }

      case "file_start":
      case "file_chunk":
      case "file_complete":
      case "file_cancel": {
        this.fileTransfer.handleFilePacket(peerId, packet);
        break;
      }
    }
  }

  public sendDeliveryAck(peerId: string, messageId: string) {
    this.webrtc.sendDataPacket(peerId, {
      id: `ack_${Date.now()}`,
      type: "delivery_ack",
      timestamp: Date.now(),
      senderId: this.myDeviceId,
      senderName: this.myDeviceName,
      payload: { messageId },
    });
  }

  public sendReadAck(peerId: string, messageId: string) {
    this.webrtc.sendDataPacket(peerId, {
      id: `read_${Date.now()}`,
      type: "read_ack",
      timestamp: Date.now(),
      senderId: this.myDeviceId,
      senderName: this.myDeviceName,
      payload: { messageId },
    });
  }

  public sendTyping(peerId: string, isTyping: boolean) {
    this.webrtc.sendDataPacket(peerId, {
      id: `type_${Date.now()}`,
      type: "typing",
      timestamp: Date.now(),
      senderId: this.myDeviceId,
      senderName: this.myDeviceName,
      payload: { isTyping },
    });
  }

  /**
   * Local private history persistence (Indexed/Local device only)
   */
  public getChatHistory(peerId: string): ChatMessage[] {
    try {
      const raw = localStorage.getItem(`${CHAT_STORAGE_PREFIX}${peerId}`);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn("Failed to load chat history:", e);
    }
    return [];
  }

  public saveMessageToHistory(peerId: string, msg: ChatMessage) {
    try {
      const history = this.getChatHistory(peerId);
      // Avoid duplicates
      const index = history.findIndex((m) => m.id === msg.id);
      if (index >= 0) {
        history[index] = msg;
      } else {
        history.push(msg);
      }
      // Limit to last 500 messages per peer to avoid quota limits
      const trimmed = history.slice(-500);
      localStorage.setItem(`${CHAT_STORAGE_PREFIX}${peerId}`, JSON.stringify(trimmed));
    } catch (e) {
      console.warn("Failed to save message to history:", e);
    }
  }

  public updateFileProgressInHistory(
    peerId: string,
    fileId: string,
    progress: number,
    status: FileTransferItem["status"],
    url?: string
  ) {
    try {
      const history = this.getChatHistory(peerId);
      const msg = history.find((m) => m.id === fileId || (m.file && m.file.id === fileId));
      if (msg && msg.file) {
        msg.file.progress = progress;
        msg.file.status = status;
        if (url) {
          msg.file.url = url;
        }
        localStorage.setItem(`${CHAT_STORAGE_PREFIX}${peerId}`, JSON.stringify(history));
      }
    } catch (e) {
      console.warn("Failed to update file progress in history:", e);
    }
  }

  public updateMessageStatusInHistory(peerId: string, msgId: string, status: ChatMessage["status"]) {
    try {
      const history = this.getChatHistory(peerId);
      const msg = history.find((m) => m.id === msgId);
      if (msg) {
        msg.status = status;
        localStorage.setItem(`${CHAT_STORAGE_PREFIX}${peerId}`, JSON.stringify(history));
      }
    } catch (e) {
      console.warn("Failed to update message status:", e);
    }
  }

  public clearChatHistory(peerId: string) {
    localStorage.removeItem(`${CHAT_STORAGE_PREFIX}${peerId}`);
  }
}

