var http = require("http");
var url = require("url");

function start(route, handle) {

    function onRequest(request, response) {
        var pathname = url.parse(request.url).pathname;
        route(handle, pathname, request, response);
    }

    // === serveur HTTP du TP2 ===
    const httpServer = http.createServer(onRequest);

    // === Ajout Socket.io CORRECT ===
    const { Server } = require("socket.io");
    const io = new Server(httpServer);

    io.on("connection", (socket) => {
        console.log("Client connecté (WebSocket)");
        socket.emit("welcome", "Bienvenue via Socket.io !");

        socket.on("messageClient", (msg) => {
            console.log("Message reçu:", msg);
            io.emit("broadcast", msg);
        });
    });

    // Démarrage
    httpServer.listen(8888);
    console.log("Serveur Node.js + Socket.io démarré sur port 8888");
}

exports.start = start;
