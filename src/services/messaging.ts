import { ChatMessage, DataPacket } from "../types";
import { WebRTCManager } from "./webrtc";

const CHAT_STORAGE_PREFIX = "locallink_chat_";

export class MessagingService {
  private webrtc: WebRTCManager;
  private myDeviceId: string;
  private myDeviceName: string;
  private onMessageReceivedCallback?: (msg: ChatMessage) => void;
  private onMessageStatusUpdatedCallback?: (msgId: string, status: ChatMessage["status"]) => void;
  private onTypingStateCallback?: (peerId: string, isTyping: boolean) => void;

  constructor(
    webrtc: WebRTCManager,
    myDeviceId: string,
    myDeviceName: string,
    callbacks: {
      onMessageReceived?: (msg: ChatMessage) => void;
      onMessageStatusUpdated?: (msgId: string, status: ChatMessage["status"]) => void;
      onTypingState?: (peerId: string, isTyping: boolean) => void;
    }
  ) {
    this.webrtc = webrtc;
    this.myDeviceId = myDeviceId;
    this.myDeviceName = myDeviceName;
    this.onMessageReceivedCallback = callbacks.onMessageReceived;
    this.onMessageStatusUpdatedCallback = callbacks.onMessageStatusUpdated;
    this.onTypingStateCallback = callbacks.onTypingState;
  }

  public updateMyDeviceName(name: string) {
    this.myDeviceName = name;
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

      case "file_offer":
      case "file_chunk":
      case "file_ack": {
        // Forwarded to file transfer handler (future ready)
        this.handleFileTransferPacket(peerId, packet);
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
   * Future file transfer abstractions
   */
  public async sendFile(toPeerId: string, file: File, onProgress?: (percent: number) => void): Promise<string> {
    const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    // Placeholder abstraction structure for future file transfer expansion
    console.log(`[LocalLink Future File Architecture] Prepared sendFile for ${file.name} (${file.size} bytes) to ${toPeerId}`);
    return fileId;
  }

  public receiveFile(peerId: string, fileId: string, chunk: ArrayBuffer) {
    // Placeholder abstraction structure for receiving chunk
    console.log(`[LocalLink Future File Architecture] Received chunk for file ${fileId} from ${peerId}`);
  }

  private handleFileTransferPacket(peerId: string, packet: DataPacket) {
    console.log(`[LocalLink File Protocol] Handled packet ${packet.type} from ${peerId}`);
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
