# Stranger Truth or Dare — Python + WebRTC Starter

A beginner-friendly starter you can run locally. Two strangers are randomly paired to video chat, text chat, and play Truth or Dare.

> ⚠️ For **demo/learning** only. In production you must add age checks, moderation, and a TURN server for better connectivity.

---

## What you'll need
- **Python 3.10+**
- A modern browser (Chrome/Firefox).
- A microphone and camera.
- You're running on **localhost** (so camera/mic work without HTTPS).

## Setup (Step by Step)

1) **Open Terminal/Command Prompt** where you extracted this folder.

2) **Create and activate a virtual environment**
```bash
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate
```

3) **Install dependencies**
```bash
pip install -r requirements.txt
```

4) **Run the server**
```bash
uvicorn main:asgi_app --reload --port 8000
```
If you change the port, also change the URL below.

5) **Open the app**
- Visit: http://localhost:8000
- Open it in **two browser tabs** (or two different browsers) to simulate two strangers.

6) **Use the app**
- Check "I am 18+" then click **Start / Find Partner**.
- When paired, your camera will connect and you’ll see each other.
- Use **Truth** or **Dare** buttons to get a shared prompt.
- Use the **chat** on the right.
- Click **Next Partner** to skip and find someone else.
- **Report** logs a basic report (demo only).

---

## How it works (high level)
- **FastAPI** serves static files.
- **python-socketio** (ASGI) handles:
  - Random matchmaking (queue → pair → room).
  - WebRTC **signaling** (offers/answers/ICE) — video is P2P between browsers.
  - Chat relay.
  - Truth/Dare prompt broadcast.
- **WebRTC** uses Google public **STUN** server to discover peers (works on many networks). For strict NATs you’ll need a **TURN** server (e.g., coturn).

## Project layout
```
.
├─ main.py          # FastAPI + Socket.IO server, matchmaking & signaling
├─ prompts.py       # Sample Truth/Dare prompts
├─ requirements.txt
├─ static/
│  ├─ index.html    # UI
│  ├─ style.css     # Styling
│  └─ main.js       # Browser logic (WebRTC, chat, UI)
└─ README.md
```

## Common issues
- **Camera/Mic blocked** → Allow permissions in your browser.
- **No video connection** → Some networks need a TURN server.
- **Black video** → Close other apps using the camera.
- **Can't connect** → Ensure both tabs are on **http://localhost:8000** and not mixed with HTTPS.

## Next steps (make it production-ready)
- Add **TURN** (e.g., coturn) and set in `main.js` `iceServers` with your TURN credentials.
- Add **moderation** (nudity/harassment filters) and **rate limits**.
- Add **auth/age gating** and **blocking/report review** with a real database.
- Deploy:
  - Backend to a VPS/Cloud (HTTPS required).
  - Frontend via a CDN or the same server with TLS.
- Persist prompt history to avoid repeats per session.
