import { useEffect, useState } from "react";
import { AboutScreen } from "./components/AboutScreen";
import { BottomNav } from "./components/BottomNav";
import { ChatScreen } from "./components/ChatScreen";
import { ConnectModal } from "./components/ConnectModal";
import { DevicesScreen } from "./components/DevicesScreen";
import { HomeScreen } from "./components/HomeScreen";
import { IncomingRequestModal } from "./components/IncomingRequestModal";
import { Navbar } from "./components/Navbar";
import { QRCodeModal } from "./components/QRCodeModal";
import { RegenerateCodeModal } from "./components/RegenerateCodeModal";
import { SettingsScreen } from "./components/SettingsScreen";
import { VoiceCallModal } from "./components/VoiceCallModal";
import { useLocalLink } from "./hooks/useLocalLink";
import { AppTab } from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);

  const {
    deviceInfo,
    connectionCode,
    isSignalingReady,
    signalingError,
    peersList,
    activePeerId,
    activePeer,
    activeChatMessages,
    isTargetTyping,
    incomingRequests,
    activeCall,
    soundEnabled,
    setSoundEnabled,
    updateDeviceName,
    regenerateCode,
    connectByCode,
    reconnectPeer,
    removePeer,
    acceptConnectionRequest,
    rejectConnectionRequest,
    disconnectPeer,
    sendMessage,
    sendFile,
    sendVoiceMessage,
    startVoiceCall,
    acceptVoiceCall,
    rejectVoiceCall,
    endVoiceCall,
    toggleVoiceCallMute,
    toggleVoiceCallSpeaker,
    cancelFileTransfer,
    sendTypingIndicator,
    openChatWithPeer,
    setActivePeerId,
  } = useLocalLink();

  // Check URL parameters for direct connect link e.g. `?connect=A7K9P2`
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const targetCode = params.get("connect") || params.get("code");
    if (targetCode) {
      // Clean up URL query without reloading
      window.history.replaceState({}, document.title, window.location.pathname);
      // Auto-initiate connection
      connectByCode(targetCode);
    }
  }, []);

  const totalUnread = peersList.reduce((sum, p) => sum + p.unreadCount, 0);

  const handleOpenChat = (peerId: string) => {
    openChatWithPeer(peerId);
    setActiveTab("chat");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        deviceInfo={deviceInfo}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        connectedCount={peersList.filter((p) => p.status === "connected").length}
        unreadTotal={totalUnread}
        isSignalingReady={isSignalingReady}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
        onUpdateDeviceName={updateDeviceName}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
      />

      {/* Main Content Area */}
      <main
        className={`w-full mx-auto ${
          activeTab === "chat"
            ? "flex-1 max-w-7xl px-0 sm:px-4 md:px-6 lg:px-8 py-0 sm:pt-4 md:pt-6 pb-14 md:pb-8 flex flex-col min-h-0 h-[calc(100dvh-56px)] md:h-auto overflow-hidden md:overflow-visible"
            : "flex-1 max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 pb-20 md:pb-8"
        }`}
      >
        {activeTab === "home" && (
          <HomeScreen
            deviceInfo={deviceInfo}
            connectionCode={connectionCode}
            isSignalingReady={isSignalingReady}
            signalingError={signalingError}
            peers={peersList}
            incomingRequests={incomingRequests}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
            onOpenQrModal={() => setIsQrModalOpen(true)}
            onOpenRegenerateModal={() => setIsRegenerateModalOpen(true)}
            onUpdateDeviceName={updateDeviceName}
            onQuickConnect={connectByCode}
            onAcceptRequest={acceptConnectionRequest}
            onRejectRequest={rejectConnectionRequest}
            onOpenChat={handleOpenChat}
            onNavigateToDevices={() => setActiveTab("devices")}
          />
        )}

        {activeTab === "devices" && (
          <DevicesScreen
            peers={peersList}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
            onOpenChat={handleOpenChat}
            onDisconnectPeer={disconnectPeer}
            onReconnectPeer={reconnectPeer}
            onRemovePeer={removePeer}
          />
        )}

        {activeTab === "chat" && (
          <ChatScreen
            peers={peersList}
            activePeer={activePeer}
            activeChatMessages={activeChatMessages}
            isTargetTyping={isTargetTyping}
            onSelectPeer={openChatWithPeer}
            onSendMessage={sendMessage}
            onSendFile={sendFile}
            onSendVoiceMessage={sendVoiceMessage}
            onStartVoiceCall={startVoiceCall}
            onCancelFileTransfer={cancelFileTransfer}
            onSendTypingIndicator={sendTypingIndicator}
            onDisconnectPeer={disconnectPeer}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
          />
        )}

        {activeTab === "about" && (
          <AboutScreen
            deviceInfo={deviceInfo}
            isSignalingReady={isSignalingReady}
            peers={peersList}
          />
        )}

        {activeTab === "settings" && (
          <SettingsScreen
            deviceInfo={deviceInfo}
            connectionCode={connectionCode}
            isSignalingReady={isSignalingReady}
            soundEnabled={soundEnabled}
            onSetSoundEnabled={setSoundEnabled}
            onUpdateDeviceName={updateDeviceName}
            onOpenRegenerateModal={() => setIsRegenerateModalOpen(true)}
            onNavigateToAbout={() => setActiveTab("about")}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        connectedCount={peersList.filter((p) => p.status === "connected").length}
        unreadTotal={totalUnread}
      />

      {/* Connect Device Modal (with manual code + QR Camera scanner) */}
      <ConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onConnect={connectByCode}
      />

      {/* QR Code Modal (generates high quality scannable SVG QR) */}
      <QRCodeModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        connectionCode={connectionCode}
        deviceName={deviceInfo.deviceName}
      />

      {/* Regenerate Code Confirmation Modal */}
      <RegenerateCodeModal
        isOpen={isRegenerateModalOpen}
        onClose={() => setIsRegenerateModalOpen(false)}
        onConfirm={regenerateCode}
        currentCode={connectionCode}
      />

      {/* Incoming Connection Request Prompts */}
      <IncomingRequestModal
        requests={incomingRequests}
        onAccept={acceptConnectionRequest}
        onReject={rejectConnectionRequest}
      />

      {/* Direct P2P Voice Call Interface */}
      {activeCall && (
        <VoiceCallModal
          call={activeCall}
          onAccept={acceptVoiceCall}
          onReject={rejectVoiceCall}
          onEnd={endVoiceCall}
          onToggleMute={toggleVoiceCallMute}
          onToggleSpeaker={toggleVoiceCallSpeaker}
        />
      )}
    </div>
  );
}
