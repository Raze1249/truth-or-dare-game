let socket = new WebSocket(`wss://${window.location.host}/match`);
let statusDiv = document.getElementById("status");
let gameDiv = document.getElementById("game");
let questionBox = document.getElementById("question-box");
let responseBox = document.getElementById("response-box");

socket.onopen = () => {
    statusDiv.innerText = "Connected! Waiting for a partner...";
};

socket.onmessage = (event) => {
    let data = JSON.parse(event.data);

    if (data.type === "start") {
        statusDiv.innerText = "Partner found! Start playing.";
        gameDiv.style.display = "block";
    }

    if (data.type === "truth") {
        questionBox.innerText = "Truth: " + data.question;
    }

    if (data.type === "dare") {
        questionBox.innerText = "Dare: " + data.question;
    }

    if (data.type === "response") {
        responseBox.innerText = "Partner says: " + data.text;
    }
};

socket.onerror = () => {
    statusDiv.innerText = "Error connecting to server.";
};

document.getElementById("truth-btn").onclick = () => {
    socket.send(JSON.stringify({ type: "truth" }));
};

document.getElementById("dare-btn").onclick = () => {
    socket.send(JSON.stringify({ type: "dare" }));
};
