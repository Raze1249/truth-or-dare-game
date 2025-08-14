from fastapi import FastAPI, WebSocket
import uvicorn

app = FastAPI()

# Store waiting players & active games
waiting_player = None
games = {}

@app.get("/")
async def root():
    return {"message": "Truth or Dare server is running!"}

# WebSocket matchmaking route
@app.websocket("/match")
async def match_players(websocket: WebSocket):
    global waiting_player
    await websocket.accept()

    if waiting_player is None:
        # First player waits for opponent
        waiting_player = websocket
        await websocket.send_text("Waiting for an opponent...")
    else:
        # Pair the players
        opponent = waiting_player
        waiting_player = None

        games[websocket] = opponent
        games[opponent] = websocket

        await websocket.send_text("Opponent found! You start.")
        await opponent.send_text("Opponent found! Wait for their turn.")

        try:
            while True:
                data = await websocket.receive_text()
                await games[websocket].send_text(data)
        except:
            # Handle disconnection
            if websocket in games:
                await games[websocket].send_text("Opponent disconnected.")
                del games[games[websocket]]
                del games[websocket]

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000)
