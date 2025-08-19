// ---- UI Elements ----
const statusEl = document.getElementById("status");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const qbox = document.getElementById("qbox");
const chatInput = document.getElementById("chatInput");
const chatLog = document.getElementById("chatLog");
const youLabel = document.getElementById("youLabel");
const partnerLabel = document.getElementById("partnerLabel");

// Username modal
const nameModal = document.getElementById("nameModal");
const nameInput = document.getElementById("nameInput");
const saveNameBtn = document.getElementById("saveNameBtn");

let myName = "";
let pc, localStream;

// --- TURN + STUN (add your own TURN in prod) ---
const config = {
  iceServers: [
    { urls: [ "stun:bn-turn1.xirsys.com" ] },
    { 
      username: "iTSBhv398vgsZy4WzMwpP0xjHEyxI4T5vWwwUguiUrP7eQIz3RERqm0TnaBOY5kiAAAAAGiiu5FSYXplMTI0OQ==", 
      credential: "1d2a5906-7bf5-11f0-906d-0242ac140004", 
      urls: [
        "turn:bn-turn1.xirsys.com:80?transport=udp",
        "turn:bn-turn1.xirsys.com:3478?transport=udp",
        "turn:bn-turn1.xirsys.com:80?transport=tcp",
        "turn:bn-turn1.xirsys.com:3478?transport=tcp",
        "turns:bn-turn1.xirsys.com:443?transport=tcp",
        "turns:bn-turn1.xirsys.com:5349?transport=tcp"
      ]
    }
  ]
};

// One WS for signaling, persistent across partners
const ws = new WebSocket(`wss://${location.host}/ws`);

// --------------- Helpers ---------------
function addChat(msg, me = false) {
  const div = document.createElement("div");
  div.textContent = msg;
  div.style.textAlign = me ? "right" : "left";
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function initMedia() {
  if (localStream) return; // reuse if already granted
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
}

function createPC() {
  pc = new RTCPeerConnection(config);
  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
  pc.ontrack = e => { remoteVideo.srcObject = e.streams[0]; };
  pc.onicecandidate = e => {
    if (e.candidate) ws.send(JSON.stringify({ type: "candidate", candidate: e.candidate }));
  };
}

async function startCall() {
  createPC();
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  ws.send(JSON.stringify({ type: "offer", sdp: offer.sdp }));
}

function resetRemote() {
  if (pc) { pc.close(); pc = null; }
  if (remoteVideo.srcObject) {
    remoteVideo.srcObject.getTracks().forEach(t => t.stop());
    remoteVideo.srcObject = null;
  }
  partnerLabel.textContent = "Partner";
  qbox.textContent = "Press Truth or Dare to start!";
}

// --------------- WS Events ---------------
ws.onopen = () => {
  statusEl.textContent = "Connected. Set your username.";
  // show modal immediately
  nameModal.style.display = "flex";
};

ws.onmessage = async (ev) => {
  const data = JSON.parse(ev.data);

  if (data.type === "waiting") {
    statusEl.textContent = data.msg;
  }

  if (data.type === "paired") {
    statusEl.textContent = "Partner found!";
    resetRemote();
    await initMedia();
    // Always (re)send your name to the new partner
    if (myName) ws.send(JSON.stringify({ type: "set_name", name: myName }));
    if (data.role === "caller") startCall();
    else createPC();
  }

  if (data.type === "peer_name") {
    partnerLabel.textContent = data.name || "Partner";
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
    statusEl.textContent = "Partner disconnected. Looking for a new one…";
    resetRemote();
    // Ask server to requeue us
    ws.send(JSON.stringify({ type: "next" }));
  }

  if (data.type === "truth") qbox.textContent = "Truth: " + data.question;
  if (data.type === "dare")  qbox.textContent = "Dare: "  + data.question;
  if (data.type === "chat")  addChat(data.text, false);
};

// --------------- UI Actions ---------------
document.getElementById("truthBtn").onclick = () => ws.send(JSON.stringify({ type: "truth" }));
document.getElementById("dareBtn").onclick  = () => ws.send(JSON.stringify({ type: "dare" }));

document.getElementById("sendBtn").onclick = () => {
  const text = chatInput.value.trim();
  if (!text) return;
  // We show "You: ..." locally, server tags partner message with their name
  addChat(`You: ${text}`, true);
  ws.send(JSON.stringify({ type: "chat", text }));
  chatInput.value = "";
};

document.getElementById("toggleMic").onclick = async () => {
  await initMedia();
  localStream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
};
document.getElementById("toggleCam").onclick = async () => {
  await initMedia();
  localStream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
};

document.getElementById("nextBtn").onclick = () => {
  statusEl.textContent = "Looking for a new partner…";
  resetRemote();
  ws.send(JSON.stringify({ type: "next" }));
};

// Username modal handlers
saveNameBtn.onclick = () => {
  const val = nameInput.value.trim().slice(0, 32) || "Player";
  myName = val;
  youLabel.textContent = myName || "You";
  ws.send(JSON.stringify({ type: "set_name", name: myName }));
  nameModal.style.display = "none";
};
nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveNameBtn.click();
});
