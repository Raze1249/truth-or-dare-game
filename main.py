from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import random

app = FastAPI()

# Serve your frontend
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def index():
    return FileResponse("static/index.html")

# --- Matchmaking + signaling (1-to-1) ---
waiting = None           # one waiting client
partner_of = {}          # ws -> partner ws

TRUTHS = [
    "What is your biggest fear?", "Your most embarrassing moment?",
    "Who was your first crush?", "A secret you’ve never told anyone?"
]
DARES = [
    "Dance for 30 seconds.", "Sing a song loudly.",
    "Do 10 push-ups.", "Talk in an accent for 2 turns."
]

@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    global waiting, partner_of
    await ws.accept()

    # Pair or wait
    if waiting is None:
        waiting = ws
        await ws.send_json({"type": "waiting", "msg": "Waiting for a partner..."})
    else:
        partner = waiting
        waiting = None
        partner_of[ws] = partner
        partner_of[partner] = ws
        # choose a caller (starts WebRTC offer)
        await ws.send_json({"type": "paired", "role": "caller"})
        await partner.send_json({"type": "paired", "role": "callee"})

    try:
        while True:
            data = await ws.receive_json()

            # relay anything to the partner (offer/answer/candidate/chat/game)
            p = partner_of.get(ws)
            if not p:
                continue

            t = data.get("type")

            if t in ("offer", "answer", "candidate", "chat"):
                await p.send_json(data)

            elif t == "truth":
                q = random.choice(TRUTHS)
                await ws.send_json({"type": "truth", "question": q})
                await p.send_json({"type": "truth", "question": q})

            elif t == "dare":
                q = random.choice(DARES)
                await ws.send_json({"type": "dare", "question": q})
                await p.send_json({"type": "dare", "question": q})

    except WebSocketDisconnect:
        # clean up + notify partner
        p = partner_of.pop(ws, None)
        if p:
            partner_of.pop(p, None)
            try:
                await p.send_json({"type": "peer-left"})
            except:
                pass
        if waiting is ws:
            waiting = None
