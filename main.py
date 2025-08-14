from fastapi import FastAPI, WebSocket
import uvicorn

app = FastAPI()

# Test GET route
@app.get("/")
async def root():
    return {"message": "Truth or Dare server is running!"}

# Simple WebSocket route
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    await websocket.send_text("Connected to Truth or Dare server")
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"You said: {data}")
    except Exception as e:
        print("WebSocket closed:", e)

# For local testing
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000)
