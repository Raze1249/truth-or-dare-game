<!DOCTYPE html>
<html>
<head>
    <title>Truth or Dare Game</title>
    <style>
        body { font-family: Arial; text-align: center; background: #fafafa; }
        #messages { border: 1px solid #ccc; height: 300px; overflow-y: scroll; margin: 20px auto; width: 80%; padding: 10px; background: white; }
        button { padding: 10px 15px; margin: 5px; font-size: 16px; }
        input { padding: 8px; font-size: 16px; width: 60%; }
    </style>
</head>
<body>

<h1>🎯 Truth or Dare Game</h1>
<div id="messages"></div>

<input id="msgBox" type="text" placeholder="Type your message..." />
<button onclick="sendMessage()">Send</button>
<br>
<button onclick="sendTruth()">Truth</button>
<button onclick="sendDare()">Dare</button>

<script>
    // Replace with your Render WebSocket URL
    let socket = new WebSocket("wss://your-render-url.onrender.com/match");
    let messagesDiv = document.getElementById("messages");

    socket.onopen = function() {
        addMessage("✅ Connected to server. Waiting for partner...");
    };

    socket.onmessage = function(event) {
        addMessage("Partner: " + event.data);
    };

    socket.onclose = function() {
        addMessage("❌ Disconnected from server.");
    };

    function sendMessage() {
        let text = document.getElementById("msgBox").value;
        if (text.trim() !== "") {
            socket.send(text);
            addMessage("You: " + text);
            document.getElementById("msgBox").value = "";
        }
    }

    function sendTruth() {
        const truths = [
            "What is your most embarrassing moment?",
            "Who was your first crush?",
            "What's the biggest lie you have told?"
        ];
        let q = "TRUTH: " + truths[Math.floor(Math.random() * truths.length)];
        socket.send(q);
        addMessage("You (Truth): " + q);
    }

    function sendDare() {
        const dares = [
            "Sing a song out loud!",
            "Dance for 30 seconds.",
            "Do 10 push-ups right now."
        ];
        let q = "DARE: " + dares[Math.floor(Math.random() * dares.length)];
        socket.send(q);
        addMessage("You (Dare): " + q);
    }

    function addMessage(msg) {
        messagesDiv.innerHTML += `<div>${msg}</div>`;
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
</script>

</body>
</html>
