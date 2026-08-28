import { useEffect, useState } from "react";
import { BottomNav } from "./components/BottomNav";
import { ChatScreen } from "./components/ChatScreen";
import { ConnectModal } from "./components/ConnectModal";
import { DevicesScreen } from "./components/DevicesScreen";
import { HomeScreen } from "./components/HomeScreen";
import { IncomingRequestModal } from "./components/IncomingRequestModal";
import { Navbar } from "./components/Navbar";
import { QRCodeModal } from "./components/QRCodeModal";
import { SettingsScreen } from "./components/SettingsScreen";
import { useLocalLink } from "./hooks/useLocalLink";

export default function App() {
  const [activeTab, setActiveTab] = useState<"home" | "devices" | "chat" | "settings">("home");
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

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
    soundEnabled,
    setSoundEnabled,
    updateDeviceName,
    regenerateCode,
    connectByCode,
    acceptConnectionRequest,
    rejectConnectionRequest,
    disconnectPeer,
    sendMessage,
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20 md:pb-8">
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
            onRegenerateCode={regenerateCode}
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
            onSendTypingIndicator={sendTypingIndicator}
            onDisconnectPeer={disconnectPeer}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
          />
        )}

        {activeTab === "settings" && (
          <SettingsScreen
            deviceInfo={deviceInfo}
            connectionCode={connectionCode}
            isSignalingReady={isSignalingReady}
            onUpdateDeviceName={updateDeviceName}
            onRegenerateCode={regenerateCode}
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

      {/* Connect Device Modal */}
      <ConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onConnect={connectByCode}
      />

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        connectionCode={connectionCode}
        deviceName={deviceInfo.deviceName}
      />

      {/* Incoming Connection Request Prompts */}
      <IncomingRequestModal
        requests={incomingRequests}
        onAccept={acceptConnectionRequest}
        onReject={rejectConnectionRequest}
      />
    </div>
  );
}
