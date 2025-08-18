from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import random

app = FastAPI()

# Serve static frontend
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def root():
    return FileResponse("static/index.html")

# --- Matchmaking state ---
waiting = None                   # a single waiting socket
partner_of = {}                  # ws -> partner ws
names = {}                       # ws -> display name

# Truth/Dare content
TRUTHS = [
    "What is your biggest fear?",
    "Who was your first crush?",
    "What's the most embarrassing thing you've done?",
    "What's a secret you've never told anyone?"
]
DARES = [
    "Do 10 push-ups!",
    "Sing your favorite song loudly!",
    "Dance for 30 seconds!",
    "Talk in an accent until your next turn."
]

async def pair(ws: WebSocket):
    """Place ws into a pair if someone is waiting; otherwise set as waiting."""
    global waiting, partner_of
    if waiting is None:
        # No one waiting; queue this user
        waiting = ws
        await ws.send_json({"type": "waiting", "msg": "Waiting for a partner..."})
    else:
        # Pair with the waiting user
        partner = waiting
        waiting = None
        partner_of[ws] = partner
        partner_of[partner] = ws
        await ws.send_json({"type": "paired", "role": "caller"})
        await partner.send_json({"type": "paired", "role": "callee"})
        # If either already set a name, notify the other
        if ws in names:
            try: await partner.send_json({"type": "peer_name", "name": names[ws]})
            except: pass
        if partner in names:
            try: await ws.send_json({"type": "peer_name", "name": names[partner]})
            except: pass

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    global waiting, partner_of, names
    await ws.accept()
    await pair(ws)

    try:
        while True:
            data = await ws.receive_json()
            t = data.get("type")
            p = partner_of.get(ws)

            # --- Username handling ---
            if t == "set_name":
                name = (data.get("name") or "").strip()[:32] or "Player"
                names[ws] = name
                # Tell partner this user's name
                if p:
                    try:
                        await p.send_json({"type": "peer_name", "name": name})
                    except:
                        pass
                continue

            # --- Next Partner / Requeue ---
            if t == "next":
                # Inform current partner and unlink
                if p:
                    partner_of.pop(p, None)
                    try: await p.send_json({"type": "peer-left"})
                    except: pass
                partner_of.pop(ws, None)
                # Requeue this client
                await pair(ws)
                # Re-send our name to new partner when paired (front-end also resends on 'paired')
                continue

            # --- Game actions (server generates the card and sends to both) ---
            if t in ("truth", "dare"):
                q = random.choice(TRUTHS if t == "truth" else DARES)
                payload = {"type": t, "question": q}
                try: await ws.send_json(payload)
                except: pass
                if p:
                    try: await p.send_json(payload)
                    except: pass
                continue

            # --- Chat: attach sender name on the server, forward to partner ---
            if t == "chat":
                msg = f"{names.get(ws, 'Partner')}: {data.get('text','')[:500]}"
                if p:
                    try: await p.send_json({"type": "chat", "text": msg})
                    except: pass
                continue

            # --- WebRTC signaling passthrough ---
            if t in ("offer", "answer"):
                if p:
                    try: await p.send_json({"type": t, "sdp": data.get("sdp")})
                    except: pass
                continue

            if t == "candidate":
                if p:
                    try: await p.send_json({"type": "candidate", "candidate": data.get("candidate")})
                    except: pass
                continue

    except WebSocketDisconnect:
        # Clean up links and notify partner
        p = partner_of.pop(ws, None)
        if p:
            partner_of.pop(p, None)
            try: await p.send_json({"type": "peer-left"})
            except: pass
        if waiting is ws:
            waiting = None
        names.pop(ws, None)
