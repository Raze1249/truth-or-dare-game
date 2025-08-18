const ws = new WebSocket(`wss://${location.host}/ws`);
const statusEl = document.getElementById("status");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const qbox = document.getElementById("qbox");
const chatInput = document.getElementById("chatInput");
const chatLog = document.getElementById("chatLog");

let pc, localStream;

// --- TURN + STUN ---
const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:global.relay.metered.ca:80",
      username: "openai",
      credential: "openai123"
    },
    {
      urls: "turn:global.relay.metered.ca:443",
      username: "openai",
      credential: "openai123"
    }
  ]
};

// Init mic/cam
async function initMedia() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
}

// Create PeerConnection
function createPC() {
  pc = new RTCPeerConnection(config);
  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
  pc.ontrack = e => { remoteVideo.srcObject = e.streams[0]; };
  pc.onicecandidate = e => {
    if (e.candidate) ws.send(JSON.stringify({ type: "candidate", candidate: e.candidate }));
  };
}

// Start call
async function startCall() {
  createPC();
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  ws.send(JSON.stringify({ type: "offer", sdp: offer.sdp }));
}

// Reset + Next Partner
function resetConnection() {
  if (pc) { pc.close(); pc = null; }
  if (remoteVideo.srcObject) {
    remoteVideo.srcObject.getTracks().forEach(t => t.stop());
    remoteVideo.srcObject = null;
  }
  statusEl.textContent = "Looking for a new partner...";
  ws.send(JSON.stringify({ type: "next" }));
}
document.getElementById("nextBtn").onclick = resetConnection;

// --- WebSocket Events ---
ws.onmessage = async ev => {
  const data = JSON.parse(ev.data);

  if (data.type === "waiting") statusEl.textContent = data.msg;

  if (data.type === "paired") {
    statusEl.textContent = "Partner found!";
    await initMedia();
    if (data.role === "caller") startCall();
    else createPC();
  }

  if (data.type === "offer") {
    await pc.setRemoteDescription({ type: "offer", sdp: data.sdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    ws.send(JSON.stringify({ type: "answer", sdp: answer.sdp }));
  }

  if (data.type === "answer") {
    await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
  }

  if (data.type === "candidate") {
    try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch {}
  }

  if (data.type === "peer-left") {
    statusEl.textContent = "Partner disconnected. Reconnecting...";
    resetConnection();
  }

  if (data.type === "truth") qbox.textContent = "Truth: " + data.question;
  if (data.type === "dare") qbox.textContent = "Dare: " + data.question;
  if (data.type === "chat") addChat(data.text, false);
};

// --- Chat ---
function addChat(msg, me) {
  const div = document.createElement("div");
  div.textContent = msg;
  div.style.textAlign = me ? "right" : "left";
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}
document.getElementById("sendBtn").onclick = () => {
  const text = chatInput.value;
  if (!text) return;
  ws.send(JSON.stringify({ type: "chat", text }));
  addChat(text, true);
  chatInput.value = "";
};

// --- Truth/Dare ---
document.getElementById("truthBtn").onclick = () => ws.send(JSON.stringify({ type: "truth" }));
document.getElementById("dareBtn").onclick  = () => ws.send(JSON.stringify({ type: "dare" }));

// --- Mic / Cam ---
document.getElementById("toggleMic").onclick = () => {
  localStream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
};
document.getElementById("toggleCam").onclick = () => {
  localStream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
};
