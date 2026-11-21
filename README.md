# CueDesk Web — One-Page AI Technical Interview Assistant

A streamlined, mobile-first, one-page technical interview assistant engineered for fast, human-sounding live answers, real-time speech recognition, and zero-horizontal-scroll code readability on mobile phones.

---

## ⚡ Highlights

- **Ultra-Lean Layout**:
  - Pinned single-line top bar (`~40px`) with Live status indicator, Auto/Manual toggle, and Start/End session controls.
  - Pinned slim live-transcription pill with waveform indicator.
  - Over **92% of vertical screen space** dedicated exclusively to the latest question and answer.
- **Pitch Black OLED Theme**:
  - Pure `#000000` pitch black background for optimal contrast, battery efficiency, and zero eye fatigue.
- **Inter Typography & Tight Spacing**:
  - Font: Google `Inter` with condensed tracking (`tracking-tight`) for high scannability.
- **Strict Human Spoken Answers**:
  - Always begins with `"How I would approach it:"` followed by 1–2 natural, conversational candidate sentences.
  - Sounds like an experienced engineer talking directly to a colleague — zero textbook or AI assistant boilerplate.
- **First-Principles Code Requirement**:
  - **No trivial built-in shortcuts**: Implements algorithms from scratch (pointers, loops, custom maps) without cheating using `.reverse()`, `s[::-1]`, `flat()`, or `Counter()`.
- **Zero Horizontal Scroll on Mobile**:
  - Soft-wrapped code blocks (`whitespace-pre-wrap break-words`) that naturally fit 360px–420px mobile viewports.
  - **Auto-expanding block height**: No fixed height or inner nested scrollbar. The code length sets the container height.
- **Language Switcher on the Code Block**:
  - Dropdown placed directly in the top right corner of the code block.
  - Restricted to **JavaScript** (default) and **Python**.
  - One tap converts the code to the alternative language on demand!
- **Deep Spoken Complexity Explanations**:
  - Verbal reasoning for **Time Complexity** and **Space Complexity** with clear *"Why"* explanations.
- **Continuous Conversation Context & Follow-Ups**:
  - Retains conversational history so follow-up questions (*"Now write it recursively"*, *"What if the array is empty?"*) understand the context.
  - Sliding-window context compressor to strictly respect **Groq Free Tier limits** (TPM & RPM) without ever crashing.
- **Auto & Manual Modes**:
  - **Auto Mode**: Adaptive silence detector (1.6s) auto-triggers answer generation once a question is spoken.
  - **Manual Mode**: Fixed floating **🧠 Brain Button** in the bottom-right corner for 1-click trigger.

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+ installed

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory:
```env
GROQ_API_KEY=your_groq_api_key_here
PORT=3000
```

### 4. Run Locally
```bash
# Start production server
npm start

# Or start in Vite dev mode:
npm run dev
```

Visit `http://localhost:3000` on your desktop or `http://<your-local-ip>:3000` from your mobile browser on the same Wi-Fi network!

---

## 📱 Mobile Best Practices
- Open in Safari (iOS) or Chrome (Android).
- Tap **Start** in the top right to grant microphone permissions.
- In **Auto Mode**, simply speak your question; CueDesk will auto-detect when you finish speaking and stream the answer.
- In **Manual Mode**, speak and tap the glowing **🧠 Brain Button** in the bottom right corner whenever you want an answer.

---

## 🛠️ Tech Stack
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, Google Fonts (Inter & JetBrains Mono)
- **Backend**: Node.js, Express, Groq Cloud SDK (`openai/gpt-oss-120b` with automated fallback)
- **Speech**: Web Speech API with echo-cancellation, noise-suppression, and auto-gain control
