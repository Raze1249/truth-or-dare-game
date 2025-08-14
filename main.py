from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import random

app = FastAPI()

# Serve static folder
app.mount("/static", StaticFiles(directory="static"), name="static")

# Store connected players
waiting_player = None
active_pairs = {}

# Some sample questions
truth_questions = [
    "What is your biggest fear?",
    "Have you ever lied to your best friend?",
    "What is your most embarrassing moment?",
    "Who was your first crush?"
]

dare_questions = [
    "Do 10 push-ups right now!",
    "Sing your favorite song out loud.",
    "Dance for 30 seconds without music.",
    "Speak in an accent for the next 2 turns."
]

@app.get("/")
async def get_index():
    return FileResponse("static/index.html")

@app.websocket("/match")
async def match_players(websocket: WebSocket):
    global waiting_player, active_pairs
    await websocket.accept()

    if waiting_player is None:
        waiting_player = websocket
        await websocket.send_json({"type": "status", "message": "Waiting for a partner..."})
    else:
        partner = waiting_player
        waiting_player = None
        active_pairs[websocket] = partner
        active_pairs[partner] = websocket

        await websocket.send_json({"type": "start"})
        await partner.send_json({"type": "start"})

    try:
        while True:
            data = await websocket.receive_json()

            if data["type"] == "truth":
                question = random.choice(truth_questions)
                await websocket.send_json({"type": "truth", "question": question})
                if websocket in active_pairs:
                    await active_pairs[websocket].send_json({"type": "truth", "question": question})

            elif data["type"] == "dare":
                question = random.choice(dare_questions)
                await websocket.send_json({"type": "dare", "question": question})
                if websocket in active_pairs:
                    await active_pairs[websocket].send_json({"type": "dare", "question": question})

    except WebSocketDisconnect:
        if websocket in active_pairs:
            partner = active_pairs[websocket]
            await partner.send_json({"type": "status", "message": "Partner disconnected."})
            del active_pairs[partner]
            del active_pairs[websocket]
        elif websocket == waiting_player:
            waiting_player = None
