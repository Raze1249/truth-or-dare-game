
import asyncio
import random
import secrets
from collections import deque

import socketio
from fastapi import FastAPI
app = FastAPI()

@app.get("/")
def read_root():
    return{"message": "hello from Truth or Dare!"}
from fastapi.staticfiles import StaticFiles

from prompts import TRUTHS, DARES

# --- FastAPI (for static files) ---
fastapi_app = FastAPI()
fastapi_app.mount("/", StaticFiles(directory="static", html=True), name="static")

# --- Socket.IO server (ASGI) ---
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)

# Wrap the FastAPI app so Socket.IO handles /socket.io/*
asgi_app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)

# --- Simple in-memory state ---
queue = deque()  # waiting users (sid)
sid_in_queue = set()
room_pairs = {}  # room_id -> (sid1, sid2)
sid_to_room = {}  # sid -> room_id
reports = []     # collected reports (in-memory; just for demo)

def other_in_room(room_id: str, me_sid: str):
    s1, s2 = room_pairs.get(room_id, (None, None))
    return s2 if me_sid == s1 else s1

async def try_match():
    # Pair users from the queue
    while len(queue) >= 2:
        s1 = queue.popleft()
        sid_in_queue.discard(s1)
        # Skip any disconnected sids that might still be queued
        try:
            await sio.get_session(s1)
        except Exception:
            continue

        s2 = queue.popleft()
        sid_in_queue.discard(s2)
        try:
            await sio.get_session(s2)
        except Exception:
            # Put s1 back if s2 is gone
            queue.appendleft(s1)
            sid_in_queue.add(s1)
            continue

        room_id = secrets.token_hex(4)
        room_pairs[room_id] = (s1, s2)
        sid_to_room[s1] = room_id
        sid_to_room[s2] = room_id

        await sio.enter_room(s1, room_id)
        await sio.enter_room(s2, room_id)

        # Assign roles for WebRTC (caller starts the offer)
        await sio.save_session(s1, {"room": room_id, "role": "caller"})
        await sio.save_session(s2, {"room": room_id, "role": "callee"})

        await sio.emit("matched", {"room": room_id, "role": "caller"}, to=s1)
        await sio.emit("matched", {"room": room_id, "role": "callee"}, to=s2)

@sio.event
async def connect(sid, environ, auth):
    # Prepare an empty session for this sid
    await sio.save_session(sid, {})
    # Nothing else; user must click "Start" (join_queue) from the UI

@sio.event
async def join_queue(sid):
    if sid not in sid_in_queue and sid not in sid_to_room:
        queue.append(sid)
        sid_in_queue.add(sid)
        await sio.emit("status", {"message": "Searching for a partner..."}, to=sid)
        await try_match()

@sio.event
async def disconnect(sid):
    # Remove from queue if present
    if sid in sid_in_queue:
        sid_in_queue.discard(sid)
        try:
            queue.remove(sid)
        except ValueError:
            pass

    # If in a room, notify the partner and clean up
    room_id = sid_to_room.pop(sid, None)
    if room_id:
        partner = other_in_room(room_id, sid)
        # Remove both from room state
        pair = room_pairs.pop(room_id, None)
        try:
            await sio.leave_room(sid, room_id)
        except Exception:
            pass
        if partner:
            try:
                await sio.leave_room(partner, room_id)
            except Exception:
                pass
            # If partner is still connected, tell them and requeue them
            try:
                await sio.emit("partner_left", {}, to=partner)
                # Requeue partner to find someone else automatically
                if partner not in sid_in_queue and partner not in sid_to_room:
                    queue.append(partner)
                    sid_in_queue.add(partner)
                    await try_match()
            except Exception:
                pass

@sio.event
async def skip(sid):
    """User wants to skip to the next partner."""
    room_id = sid_to_room.get(sid)
    if not room_id:
        return
    partner = other_in_room(room_id, sid)

    # Clean up room
    for s in (sid, partner):
        if not s:
            continue
        try:
            await sio.leave_room(s, room_id)
        except Exception:
            pass
        sid_to_room.pop(s, None)

    room_pairs.pop(room_id, None)

    # Notify partner that they were skipped (if still connected)
    if partner:
        try:
            await sio.emit("partner_skipped", {}, to=partner)
        except Exception:
            pass

    # Put both back into the queue to match again
    for s in (sid, partner):
        if s and s not in sid_in_queue and s not in sid_to_room:
            queue.append(s)
            sid_in_queue.add(s)

    await try_match()

@sio.event
async def report(sid, data):
    """Basic demo reporting; stores in memory."""
    reason = (data or {}).get("reason", "unspecified")
    room_id = sid_to_room.get(sid)
    reports.append({"reporter": sid, "room": room_id, "reason": reason})
    await sio.emit("status", {"message": "Thanks, report received."}, to=sid)


@sio.event
async def chat_message(sid, data):
    room_id = sid_to_room.get(sid)
    if not room_id:
        return
    text = (data or {}).get("text", "")
    if not text:
        return
    # Relay to everyone in the room except sender
    await sio.emit("chat_message", {"text": text}, room=room_id, skip_sid=sid)

# --- WebRTC signaling events (relayed through Socket.IO) ---
@sio.event
async def webrtc_offer(sid, data):
    room_id = sid_to_room.get(sid)
    if not room_id:
        return
    await sio.emit("webrtc_offer", data, room=room_id, skip_sid=sid)

@sio.event
async def webrtc_answer(sid, data):
    room_id = sid_to_room.get(sid)
    if not room_id:
        return
    await sio.emit("webrtc_answer", data, room=room_id, skip_sid=sid)

@sio.event
async def webrtc_ice_candidate(sid, data):
    room_id = sid_to_room.get(sid)
    if not room_id:
        return
    await sio.emit("webrtc_ice_candidate", data, room=room_id, skip_sid=sid)

# --- Truth or Dare prompts ---
@sio.event
async def request_prompt(sid, data):
    kind = (data or {}).get("type", "truth")
    pool = TRUTHS if kind == "truth" else DARES
    prompt = random.choice(pool) if pool else "No prompts available."
    room_id = sid_to_room.get(sid)
    if not room_id:
        return
    await sio.emit("prompt", {"type": kind, "text": prompt}, room=room_id)
