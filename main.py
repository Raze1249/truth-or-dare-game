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
waiting = None
partner_of = {}

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
