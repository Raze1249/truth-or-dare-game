from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

# Create FastAPI app instance
app = FastAPI()(debug=True)
from fastapi import WebSocket

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    await websocket.send_text("Connected to Truth or Dare")

# Mount static files (CSS, JS, images)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Set up templates folder
templates = Jinja2Templates(directory="templates")

# Home route
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})
