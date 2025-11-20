const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const WebSocket = require('ws');
const url = require('url');
const app = express();
const server = http.createServer(app);

// --- Serve static files from current folder ---
app.use(express.static(__dirname));

// ----- Socket.io -----
const io = socketIO(server);
let socketChannels = {};

io.on('connection', socket => {
    console.log('Socket.io connected:', socket.id);

    socket.on('create or join', channel => {
        socket.channel = channel;
        if (!socketChannels[channel]) socketChannels[channel] = [];
        const clients = socketChannels[channel];

        if (clients.length >= 4) {
            socket.emit('full', channel);
            return;
        }

        clients.push(socket.id);
        socket.join(channel);

        if (clients.length === 1) socket.emit('created', channel);
        else {
            socket.emit('joined', channel);
            socket.to(channel).emit('remotePeerJoining', channel);
            io.to(channel).emit('broadcast: joined', `Client ${socket.id} joined ${channel}`);
        }

        // Messages
        socket.on('message', data => {
            socket.to(socket.channel).emit('message', { from: socket.id, ...data });
        });

        socket.on('disconnect', () => {
            socketChannels[channel] = socketChannels[channel].filter(id => id !== socket.id);
            if (socketChannels[channel].length === 0) delete socketChannels[channel];
        });
    });
});

// ----- WebSocket natif -----
const wss = new WebSocket.Server({ port: 8182 });
let wsChannels = {};

wss.on('connection', ws => {
    console.log('WebSocket connected');

    ws.on('message', msg => {
        try {
            const data = JSON.parse(msg);

            if (data.type === 'join') {
                ws.channel = data.channel;
                if (!wsChannels[ws.channel]) wsChannels[ws.channel] = [];
                wsChannels[ws.channel].push(ws);
                ws.send(JSON.stringify({ type: 'joined', message: `Bienvenue sur ${ws.channel}` }));

                // broadcast aux autres
                wsChannels[ws.channel].forEach(client => {
                    if (client !== ws) client.send(JSON.stringify({ type: 'peer-joined' }));
                });
            }

            if (data.type === 'message') {
                const channel = ws.channel;
                wsChannels[channel].forEach(client => {
                    if (client !== ws) client.send(JSON.stringify({ type: 'message', message: data.message }));
                });
            }
        } catch (e) {
            console.log('WebSocket error:', e);
        }
    });

    ws.on('close', () => {
        if (ws.channel && wsChannels[ws.channel]) {
            wsChannels[ws.channel] = wsChannels[ws.channel].filter(c => c !== ws);
        }
    });
});

// ----- XHR polling -----
let xhrChannels = {};
app.get('/xhrJoin', (req, res) => {
    const channel = req.query.channel;
    if (!xhrChannels[channel]) xhrChannels[channel] = [];
    xhrChannels[channel].push(res);
});
app.get('/xhrSend', (req, res) => {
    const { channel, message } = req.query;
    if (xhrChannels[channel]) {
        xhrChannels[channel].forEach(clientRes => {
            clientRes.writeHead(200, { 'Content-Type': 'application/json' });
            clientRes.end(JSON.stringify({ message }));
        });
        xhrChannels[channel] = [];
    }
    res.end('ok');
});

server.listen(8181, () => console.log('HTTP+Socket.io running on http://localhost:8181'));
console.log('WebSocket WS running on ws://localhost:8182');
