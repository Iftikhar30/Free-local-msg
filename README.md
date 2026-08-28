<div align="center">

# 🔗 LocalLink

**Private • Peer-to-Peer • Device Communication**

Connect your devices. Share messages. No account required.

<p>
  <a href="https://github.com/Iftikhar30/locallink">
    <img src="https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github" alt="GitHub">
  </a>
  <a href="https://local-rouge-gamma.vercel.app">
    <img src="https://img.shields.io/badge/Live-Demo-000000?style=for-the-badge&logo=vercel" alt="Live Demo">
  </a>
</p>

<p>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/WebRTC-P2P-333333?style=for-the-badge" alt="WebRTC">
  <img src="https://img.shields.io/badge/Vercel-Ready-000000?style=for-the-badge&logo=vercel" alt="Vercel">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License">
</p>

<p>
  <a href="#-what-is-locallink">About</a> •
  <a href="#-features">Features</a> •
  <a href="#-how-it-works">How It Works</a> •
  <a href="#️-installation">Installation</a> •
  <a href="#️-deploy-to-vercel">Deployment</a> •
  <a href="#-privacy--security">Privacy</a> •
  <a href="#️-roadmap">Roadmap</a>
</p>

<br>

> Built with **Google AI Studio**
>
> A lightweight, browser-based application for connecting multiple devices through WebRTC peer-to-peer communication.

</div>

---

## ✨ What is LocalLink?

**LocalLink** is a browser-based peer-to-peer communication app that lets you connect multiple devices using a short connection code or a QR code.

- ❌ No account
- ❌ No login
- ❌ No complicated setup

Just open the app, get your device code, connect another device, and start communicating.

```
        📱 Phone A
             │
             │
       Connection Code
          A7K9P2
             │
             ▼
      ┌─────────────┐
      │  LocalLink  │
      └─────────────┘
             │
             │ WebRTC
             ▼
        💻 Laptop B
```

---

## 🚀 Features

| Feature | Description |
|---|---|
| 🔗 Device Codes | Connect devices using a temporary 6-character code |
| 📷 QR Connection | Generate and scan QR codes for quick pairing |
| 💬 Private Messaging | Send messages to a specific connected device |
| 👥 Multi-Device | Connect multiple devices simultaneously |
| ⚡ Real-Time | Messages are delivered instantly through WebRTC |
| 🔄 Auto Reconnect | Attempts to restore connections after temporary failures |
| 💾 Local History | Chat history is stored locally on the device |
| 🔔 Connection Alerts | Sound notification for incoming connection requests |
| 🌐 Cross-Network | Can connect devices on different networks when WebRTC allows |
| 🔐 Encrypted Transport | WebRTC DataChannels provide browser-level encrypted transport |
| 🌙 Dark Mode | Modern dark/light interface |
| 📱 Responsive | Designed for phones, tablets, laptops and desktops |
| 🚫 No Login | No account or password required |

---

## 🧠 How It Works

LocalLink uses a signaling layer only to help devices discover each other and establish a WebRTC connection. Once the peer-to-peer connection is established, messaging is handled through a WebRTC DataChannel whenever a direct route is available.

```
┌────────────────────┐
│     Device A       │
│    📱 Phone / PC   │
└─────────┬──────────┘
          │ 1. Register Code
          ▼
┌────────────────────┐
│  Signaling Layer    │
│  Vercel / API       │
└─────────┬──────────┘
          │ 2. Connection Info
          ▼
┌────────────────────┐
│     Device B       │
│    💻 PC / Phone   │
└─────────┬──────────┘
          │ 3. WebRTC Handshake
          ▼
╔════════════════════════════════╗
║       DIRECT P2P CHANNEL       ║
║                                ║
║  Device A  ◄────────► Device B ║
║             WebRTC             ║
╚════════════════════════════════╝
```

### 🔑 Device Connection

Every device receives a temporary connection code.

```
┌──────────────────────────────┐
│       YOUR DEVICE CODE       │
│                              │
│           A7K9P2             │
│                              │
│         [ Copy Code ]        │
└──────────────────────────────┘
```

Another device can connect with the following flow:

```
Connect Device → Enter Code → A7K9P2 → Connection Request → Accept → 🟢 Connected
```

**Reload Protection:** Reloading the app does not intentionally generate a new device code. The code stays the same until you explicitly choose **Generate New Code**, preventing unnecessary disconnections and keeping your device identity persistent across browser reloads.

### 📷 QR Code Connection

LocalLink supports both generating and scanning QR codes.

| Device A | Device B |
|---|---|
| Show QR Code | Connect Device → Scan QR Code → 📷 Camera → QR Detected → Connection Request |

> Camera permission is requested only when you choose the QR scanner.

### 👥 Multi-Device Architecture

One device can connect to multiple peers simultaneously.

```
                         ┌──────────────┐
                         │   Phone A    │
                         └──────▲───────┘
                                │ P2P
┌──────────────┐          ┌────┴───────┐          ┌──────────────┐
│   Phone B    │◄────────►│   Laptop   │◄────────►│   Phone C    │
└──────────────┘          └────┬───────┘          └──────────────┘
                                │ P2P
                                ▼
                         ┌──────────────┐
                         │    Tablet    │
                         └──────────────┘
```

Each peer connection maintains its own:

- `RTCPeerConnection`
- `RTCDataChannel`
- Connection state & ICE state
- Message handler
- Latency measurement

### 💬 Private Messaging

Every connected device has a separate, private conversation. A message sent to Phone A is **not** broadcast to Phone B or PC.

```
Laptop
├── 📱 Phone A → Private Chat
├── 📱 Phone B → Private Chat
└── 💻 PC      → Private Chat
```

**Supported:**

- 💬 Text messages
- ✓ Delivery acknowledgement
- ✓ Read acknowledgement
- ⌨️ Typing indicator
- 🕐 Timestamps
- 🟢 Connection status
- 💾 Local chat history

### 🔄 Reconnection

Temporary network failures don't permanently destroy the peer relationship:

```
🟢 Connected → ⚠️ Connection Lost → 🔄 Reconnecting… → WebRTC Negotiation → ICE Candidate Exchange → 🟢 Connected
```

Failed peer connections are cleaned up before creating new ones, to prevent duplicate connections.

### 🔔 Connection Notifications

When another device requests a connection:

```
┌──────────────────────────────────┐
│ 🔔 Connection Request             │
│                                  │
│ John's Phone wants to connect.   │
│                                  │
│       [ Reject ]   [ Accept ]    │
└──────────────────────────────────┘
```

A short notification sound can also be played (Settings → Connection Request Sound). Note that browser autoplay restrictions may prevent sound until you've interacted with the page.

### 🌐 Network Connectivity

LocalLink is optimized for direct peer-to-peer communication:

- **Same Wi-Fi:** WebRTC can often establish a direct local connection.
- **Different Networks** (e.g. 4G/5G ↔ Home Wi-Fi): WebRTC can also establish connections across different networks when NAT traversal succeeds.

### 🧊 STUN & TURN

LocalLink supports both STUN and optional TURN infrastructure.

**STUN** — helps WebRTC discover network paths:

```
VITE_STUN_SERVERS=stun:stun.l.google.com:19302
```

**TURN** — relays traffic when a direct P2P connection can't be established. May be required for:

- Symmetric NAT
- Restrictive firewalls
- Some carrier networks
- Corporate networks

> ⚠️ **Security note:** TURN credentials should be handled securely. Permanent private secrets should never be exposed through browser-side `VITE_*` variables.

---

## 🔐 Privacy & Security

LocalLink is designed with privacy in mind.

- **🚫 No Account** — no email, password, Google login, or Facebook login required for the basic app.
- **💾 Local Chat History** — chat history is intended to remain stored locally on your device.
- **🔗 Peer-to-Peer** — when a direct WebRTC route is available, messages travel directly between connected devices.
- **🔒 WebRTC Security** — WebRTC DataChannels use browser-provided security mechanisms including DTLS and SCTP.
- **📡 Signaling** — the signaling layer only helps devices discover each other and exchange connection info; it is not intended to act as a permanent message database.

> ⚠️ **Important:** A TURN server may relay encrypted WebRTC traffic when direct connectivity is unavailable — so "direct P2P" is not guaranteed on every network.

---

## 🛠️ Technology Stack

<div align="center">

| Technology | Purpose |
|---|---|
| ⚛️ React | User Interface |
| 🔷 TypeScript | Type-safe application logic |
| ⚡ Vite | Frontend tooling |
| 🎨 Tailwind CSS | UI styling |
| 🌐 WebRTC | Peer-to-peer communication |
| 🧊 STUN / ICE | NAT traversal |
| 🔁 TURN | Optional relay |
| ▲ Vercel | Deployment & signaling API |

</div>

---

## 📁 Project Structure

<details>
<summary><b>View Project Structure</b></summary>

```
LocalLink/
│
├── api/
│   └── signal.ts
│
├── src/
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── HomeScreen.tsx
│   │   ├── DevicesScreen.tsx
│   │   ├── ChatScreen.tsx
│   │   ├── SettingsScreen.tsx
│   │   ├── AboutScreen.tsx
│   │   ├── ConnectModal.tsx
│   │   ├── QRCodeModal.tsx
│   │   ├── QRScannerModal.tsx
│   │   ├── IncomingRequestModal.tsx
│   │   └── BottomNav.tsx
│   │
│   ├── services/
│   │   ├── device.ts
│   │   ├── signaling.ts
│   │   ├── webrtc.ts
│   │   └── messaging.ts
│   │
│   ├── hooks/
│   │   └── useLocalLink.ts
│   │
│   ├── types.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
│
├── .env.example
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vercel.json
```

</details>

---

## ⚙️ Installation

**1. Clone the repository**

```bash
git clone https://github.com/Iftikhar30/locallink.git
cd locallink
```

**2. Install dependencies**

```bash
npm install
```

**3. Configure environment variables**

Create a `.env` file:

```env
VITE_SIGNALING_URL=

VITE_STUN_SERVERS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302,stun:stun2.l.google.com:19302

VITE_TURN_SERVER_URL=
VITE_TURN_USERNAME=
VITE_TURN_CREDENTIAL=

TURN_SERVER_URL=
TURN_USERNAME=
TURN_CREDENTIAL=
TURN_SECRET=
```

> For initial LAN testing, TURN may not be required.

**4. Start the development server**

```bash
npm run dev
```

---

## 🏗️ Production Build

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

---

## ☁️ Deploy to Vercel

**Step 1 — Push to GitHub**

```bash
git add .
git commit -m "Initial LocalLink release"
git push
```

**Step 2 — Import into Vercel**

| Setting | Value |
|---|---|
| Framework | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |

**Step 3 — Add environment variables**

Go to **Vercel → Project → Settings → Environment Variables** and add the required variables.

**Step 4 — Deploy**

After deployment, your app will be live at:

```
https://local-rouge-gamma.vercel.app
```

Open the application on two devices and test the connection.

---

## 🧪 Testing

### Test 1 — Two Phones

```
Phone A → Code: A7K9P2 → Phone B → Enter Code → Connection Request → Accept → 🟢 Connected
```

Send: `Hello from Phone A!`

**Expected result:** Phone B receives the message instantly.

### Test 2 — Multiple Devices

Connect:

```
Laptop
 ├── Phone A
 ├── Phone B
 └── Tablet
```

Send a message to Phone A.

**Expected:**

| Device | Result |
|---|---|
| Phone A | ✅ Received |
| Phone B | ❌ Not received |
| Tablet | ❌ Not received |

### Test 3 — QR

```
Phone A → Show QR → Phone B → Scan QR → Connection Request
```

### Test 4 — Reload

Connected devices: Phone A 🟢, Phone B 🟢. Reload Phone A.

**Expected:**

| Item | Result |
|---|---|
| Code | Same code |
| Device identity | Same |
| Chat history | Preserved |
| Connection | Reconnect / remains connected |

---

## 🔎 Diagnostics

The About page can display:

```
WebRTC
────────────────────────
RTCPeerConnection    ✓ Supported
RTCDataChannel        ✓ Supported
Web Cryptography      ✓ Supported
Camera                 ✓ Available
Signaling API          ✓ Online

Current Connection
────────────────────────
Transport              Direct / Relay
ICE State               Connected
DataChannel             Open
Latency                 12 ms
```

This helps diagnose browser and network problems.

---

## ⚠️ Limitations

WebRTC connectivity depends on the network — a direct P2P connection is not guaranteed in every environment. Possible limitations include:

- NAT restrictions
- Firewall rules
- Symmetric NAT
- Mobile carrier restrictions
- Corporate networks
- Browser compatibility
- Background browser suspension

### 📱 Mobile Background Behavior

iOS Safari and Android browsers may suspend or throttle background tabs. LocalLink cannot guarantee that a browser tab will remain active while the phone is locked or the app is in the background. When you return, LocalLink detects the connection state and attempts to reconnect.

---

## 🗺️ Roadmap

- [x] Device connection codes
- [x] Multi-device architecture
- [x] WebRTC messaging
- [x] QR code generation
- [x] QR code scanning
- [x] Private conversations
- [x] Local chat history
- [x] Connection notifications
- [x] Automatic reconnection
- [ ] Peer-to-peer file transfer
- [ ] Image transfer
- [ ] Drag & drop files
- [ ] Transfer progress
- [ ] Group messaging
- [ ] PWA support
- [ ] Advanced peer verification
- [ ] Audio communication
- [ ] Video communication

---

## 🤝 Contributing

Contributions are welcome! Before submitting a pull request:

1. Test the application on multiple devices.
2. Verify WebRTC functionality.
3. Run the production build.
4. Check for TypeScript errors.
5. Avoid exposing private credentials.
6. Keep the application lightweight.

```bash
npm run build
```

---

## 🔒 Security

If you discover a security vulnerability, please **do not** publicly disclose it immediately. Contact the project maintainer privately with:

- Description of the issue
- Steps to reproduce
- Potential impact
- Suggested fix, if available

---

## 📄 License

This project is intended to be released under the **MIT License**. See [LICENSE](LICENSE) for details.

---

<div align="center">

## 💙 About LocalLink

**Connect. Communicate. Directly.**

LocalLink aims to make device-to-device communication simple, fast and privacy-conscious.

No account. No complicated setup. Just connect your devices and communicate.

<br>

Built with **Google AI Studio**

<br>

⭐ If you find LocalLink useful, consider giving the repository a star.

<br>

[⬆ Back to Top](#-locallink)

</div>
