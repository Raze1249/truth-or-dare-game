from fastapi import FastAPI, WebSocket
import uvicorn

app = FastAPI()

# Store matchmaking info
waiting_player = None
games = {}  # player_socket -> opponent_socket mapping

@app.get("/")
async def root():
    return {"message": "Truth or Dare server is running!"}

@app.websocket("/match")
async def match_players(websocket: WebSocket):
    global waiting_player, games
    await websocket.accept()

    if waiting_player is None:
        # No one waiting, this player will wait
        waiting_player = websocket
        await websocket.send_text("Waiting for an opponent...")
    else:
        # Match found
        opponent = waiting_player
        waiting_player = None

        games[websocket] = opponent
        games[opponent] = websocket

        await websocket.send_text("Opponent found! You start.")
        await opponent.send_text("Opponent found! Wait for their turn.")

        # Game loop
        try:
            while True:
                data = await websocket.receive_text()
                if websocket in games:
                    await games[websocket].send_text(data)
        except:
            # Handle disconnection
            if websocket in games:
                try:
                    await games[websocket].send_text("Opponent disconnected.")
                except:
                    pass
                del games[games[websocket]]
                del games[websocket]

# Local test run
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000)
