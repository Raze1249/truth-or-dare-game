from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import uvicorn

app = FastAPI()

# Store connected players
waiting_player = None
active_pairs = {}

@app.get("/")
async def root():
    return {"message": "Truth or Dare Server is Running!"}

@app.websocket("/match")
async def match_players(websocket: WebSocket):
    global waiting_player
    await websocket.accept()

    # If there's a waiting player, pair them
    if waiting_player:
        partner = waiting_player
        active_pairs[websocket] = partner
        active_pairs[partner] = websocket
        waiting_player = None
        await websocket.send_text("🎯 You are connected with a partner!")
        await partner.send_text("🎯 You are connected with a partner!")
    else:
        # Wait for partner
        waiting_player = websocket
        await websocket.send_text("⏳ Waiting for a partner...")

    try:
        while True:
            data = await websocket.receive_text()
            partner = active_pairs.get(websocket)
            if partner:
                await partner.send_text(data)
    except WebSocketDisconnect:
        # Handle disconnect
        partner = active_pairs.pop(websocket, None)
        if partner:
            await partner.send_text("⚠️ Partner disconnected.")
            active_pairs.pop(partner, None)
        if waiting_player == websocket:
            waiting_player = None

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=10000)
