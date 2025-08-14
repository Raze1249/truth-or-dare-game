const statusEl = document.getElementById("status");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const qbox = document.getElementById("qbox");
const chatInput = document.getElementById("chatInput");
const chatLog = document.getElementById("chatLog");

const ws = new WebSocket(`wss://${location.host}/ws`);
let pc, localStream;

// STUN (works for most cases). For best reliability, add a TURN service later.
const pcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

function log(msg, mine=false) {
  const div = document.createElement("div");
  div.className = mine ? "msg-me" : "msg-peer";
  div.textContent = msg;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function setupMedia() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
}

function createPC() {
  pc = new RTCPeerConnection(pcConfig);

  // local tracks
  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

  // remote stream
  pc.ontrack = (e) => {
    remoteVideo.srcObject = e.streams[0];
  };

  // send ICE candidates to peer
  pc.onicecandidate = (e) => {
    if (e.candidate) {
      ws.send(JSON.stringify({ type: "candidate", candidate: e.candidate }));
    }
  };
}

async function startOffer() {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  ws.send(JSON.stringify({ type: "offer", sdp: offer.sdp }));
}

ws.onopen = async () => {
  statusEl.textContent = "Connected. Waiting for partner…";
  await setupMedia();
};

ws.onmessage = async (ev) => {
  const data = JSON.parse(ev.data);

  if (data.type === "waiting") {
    statusEl.textContent = data.msg;
  }

  if (data.type === "paired") {
    statusEl.textContent = "Partner found! Setting up video…";
    createPC();
    if (data.role === "caller") await startOffer();
  }

  if (data.type === "offer") {
    if (!pc) createPC();
    await pc.setRemoteDescription({ type: "offer", sdp: data.sdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    ws.send(JSON.stringify({ type: "answer", sdp: answer.sdp }));
  }

  if (data.type === "answer") {
    await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
  }

  if (data.type === "candidate") {
    try { await pc.addIceCandidate(data.candidate); } catch {}
  }

  if (data.type === "peer-left") {
    statusEl.textContent = "Partner disconnected.";
    if (pc) pc.close();
  }

  if (data.type === "truth") qbox.textContent = "Truth: " + data.question;
  if (data.type === "dare")  qbox.textContent = "Dare: "  + data.question;

  if (data.type === "chat")  log(data.text, false);
};

// UI actions
document.getElementById("truthBtn").onclick = () => ws.send(JSON.stringify({ type: "truth" }));
document.getElementById("dareBtn").onclick  = () => ws.send(JSON.stringify({ type: "dare" }));

document.getElementById("sendBtn").onclick = () => {
  const text = chatInput.value.trim();
  if (!text) return;
  ws.send(JSON.stringify({ type: "chat", text }));
  log(text, true);
  chatInput.value = "";
};

// Mic / Cam toggles
document.getElementById("toggleMic").onclick = () => {
  localStream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
};
document.getElementById("toggleCam").onclick = () => {
  localStream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
};
