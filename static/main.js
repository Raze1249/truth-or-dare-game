
// Basic client for matchmaking, WebRTC, chat and prompts
const statusEl = document.getElementById("status");
const startBtn = document.getElementById("startBtn");
const nextBtn = document.getElementById("nextBtn");
const reportBtn = document.getElementById("reportBtn");
const truthBtn = document.getElementById("truthBtn");
const dareBtn = document.getElementById("dareBtn");
const promptBox = document.getElementById("promptBox");
const timerEl = document.getElementById("timer");

const chatLog = document.getElementById("chatLog");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const ageGate = document.getElementById("ageGate");

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

let socket;
let pc;
let localStream;
let role = null; // "caller" or "callee"
let countdownTimer = null;

function logStatus(msg) {
  statusEl.textContent = msg;
}

function addChatLine(text, who = "them") {
  const p = document.createElement("div");
  p.className = who === "me" ? "me" : "them";
  p.textContent = (who === "me" ? "You: " : "Partner: ") + text;
  chatLog.appendChild(p);
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function initMedia() {
  if (localStream) return localStream;
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    return localStream;
  } catch (err) {
    alert("Could not access camera/microphone. Check permissions and try again.");
    throw err;
  }
}

function newPeerConnection() {
  const config = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
    ],
  };
  pc = new RTCPeerConnection(config);

  // Local ICE candidates to server
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("webrtc_ice_candidate", { candidate: event.candidate });
    }
  };

  // When remote stream arrives
  pc.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  // Add all local tracks
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });
}

function resetUIForSearch() {
  nextBtn.disabled = true;
  reportBtn.disabled = true;
  truthBtn.disabled = true;
  dareBtn.disabled = true;
  chatInput.disabled = true;
  sendBtn.disabled = true;
  timerEl.textContent = "";
  promptBox.textContent = "Click Truth/Dare to get a prompt for both of you.";
  remoteVideo.srcObject = null;
}

function enableInCallUI() {
  nextBtn.disabled = false;
  reportBtn.disabled = false;
  truthBtn.disabled = false;
  dareBtn.disabled = false;
  chatInput.disabled = false;
  sendBtn.disabled = false;
}

function startCountdown(seconds = 30) {
  clearInterval(countdownTimer);
  let remaining = seconds;
  timerEl.textContent = `⏳ ${remaining}s`;
  countdownTimer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(countdownTimer);
      timerEl.textContent = "⏰ Time's up!";
    } else {
      timerEl.textContent = `⏳ ${remaining}s`;
    }
  }, 1000);
}

// ---- Main flow ----
startBtn.addEventListener("click", async () => {
  if (!ageGate.checked) {
    alert("Please confirm you're 18+ and agree to be respectful.");
    return;
  }
  await initMedia();

  if (!socket) {
    socket = io(); // connects to /socket.io on same origin
    wireSocketEvents();
  }
  resetUIForSearch();
  socket.emit("join_queue");
  logStatus("Looking for a partner...");
});

nextBtn.addEventListener("click", () => {
  if (socket) {
    socket.emit("skip");
    logStatus("Finding a new partner...");
    resetUIForSearch();
    // Close existing peer connection
    if (pc) {
      pc.close();
      pc = null;
    }
  }
});

reportBtn.addEventListener("click", () => {
  const reason = prompt("Why are you reporting this partner? (Optional)");
  if (socket) socket.emit("report", { reason });
  alert("Report submitted. Thank you.");
});

truthBtn.addEventListener("click", () => {
  socket && socket.emit("request_prompt", { type: "truth" });
  startCountdown(30);
});

dareBtn.addEventListener("click", () => {
  socket && socket.emit("request_prompt", { type: "dare" });
  startCountdown(30);
});

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  socket.emit("chat_message", { text });
  addChatLine(text, "me");
  chatInput.value = "";
});

function wireSocketEvents() {
  socket.on("status", (data) => {
    if (data && data.message) logStatus(data.message);
  });

  socket.on("matched", async (data) => {
    role = data.role;
    logStatus("Partner found! Connecting video...");
    await initMedia();
    newPeerConnection();
    enableInCallUI();

    if (role === "caller") {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("webrtc_offer", { sdp: offer });
    }
  });

  socket.on("partner_left", () => {
    logStatus("Partner disconnected. Searching again...");
    resetUIForSearch();
    if (pc) { pc.close(); pc = null; }
  });

  socket.on("partner_skipped", () => {
    logStatus("Partner skipped. Searching again...");
    resetUIForSearch();
    if (pc) { pc.close(); pc = null; }
  });

  // WebRTC signaling
  socket.on("webrtc_offer", async (data) => {
    if (!pc) { await initMedia(); newPeerConnection(); }
    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("webrtc_answer", { sdp: answer });
  });

  socket.on("webrtc_answer", async (data) => {
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
  });

  socket.on("webrtc_ice_candidate", async (data) => {
    try {
      if (data && data.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    } catch (err) {
      console.warn("Error adding ICE candidate", err);
    }
  });

  // Chat relay
  socket.on("chat_message", (data) => {
    if (data && data.text) addChatLine(data.text, "them");
  });

  // Prompts
  socket.on("prompt", (data) => {
    if (!data) return;
    const kind = data.type === "truth" ? "Truth" : "Dare";
    promptBox.textContent = `${kind}: ${data.text}`;
  });
}

// Receive chat messages echoed from partner (server just relays to room)
if (!window._chatRelayAttached) {
  window._chatRelayAttached = true;
  // Monkey patch to relay messages to partner via Socket.IO server
  // (The server relays chat_message to room; we display our own immediately on send)
  // This listener is registered in wireSocketEvents above.
}
