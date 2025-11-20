const localVideo = document.getElementById('localVideo');
const videosContainer = document.getElementById('videos');
const chatMessages = document.getElementById('chatMessages');
const dataChannelSend = document.getElementById('dataChannelSend');
const sendButton = document.getElementById('sendButton');
const techSelect = document.getElementById('techSelect');
const joinBtn = document.getElementById('joinBtn');

let localStream;
let peers = {};
let dataChannels = {};
let channelName;
let socket, ws;

// --- capture vidéo + audio ---
async function startLocalStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
    } catch (err) {
        console.error(err);
    }
}

startLocalStream();

// --- ajouter message chat ---
function appendChat(msg) {
    const p = document.createElement('p');
    p.textContent = msg;
    chatMessages.appendChild(p);
}

// --- création PeerConnection ---
function createPeerConnection(peerId) {
    const pc = new RTCPeerConnection();
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    // Data channel
    const dc = pc.createDataChannel('chat');
    dc.onmessage = e => appendChat(`Peer ${peerId}: ${e.data}`);
    dataChannels[peerId] = dc;

    // Flux vidéo distant
    pc.ontrack = e => {
        const video = document.createElement('video');
        video.autoplay = true;
        video.srcObject = e.streams[0];
        video.id = peerId;
        videosContainer.appendChild(video);
    };

    pc.onicecandidate = e => {
        if (e.candidate) {
            if (socket) socket.emit('message', { type: 'candidate', candidate: e.candidate, to: peerId });
            if (ws) ws.send(JSON.stringify({ type: 'candidate', candidate: e.candidate }));
        }
    };

    peers[peerId] = pc;
    return pc;
}

// --- Socket.io init ---
function initSocketIO(ch) {
    socket = io('http://localhost:8181');
    channelName = ch;

    socket.on('connect', () => socket.emit('create or join', channelName));
    socket.on('created', () => console.log('Channel créé'));
    socket.on('joined', () => console.log('Vous avez rejoint'));
    socket.on('remotePeerJoining', () => console.log('Autre pair rejoint'));
    socket.on('broadcast: joined', msg => console.log(msg));

    socket.on('message', async data => {
        if (data.type === 'chat') appendChat(`Peer ${data.from}: ${data.message}`);
    });

    sendButton.onclick = () => {
        const msg = dataChannelSend.value;
        socket.emit('message', { type: 'chat', message: msg });
        appendChat('Moi: ' + msg);
        dataChannelSend.value = '';
    };
}

// --- WebSocket natif init ---
function initWebSocket(ch) {
    ws = new WebSocket('ws://localhost:8182');
    channelName = ch;

    ws.onopen = () => ws.send(JSON.stringify({ type: 'join', channel: channelName }));

    ws.onmessage = event => {
        const data = JSON.parse(event.data);
        if (data.type === 'message') appendChat('Peer: ' + data.message);
    };

    sendButton.onclick = () => {
        const msg = dataChannelSend.value;
        ws.send(JSON.stringify({ type: 'message', message: msg }));
        appendChat('Moi: ' + msg);
        dataChannelSend.value = '';
    };
}

// --- XHR polling init ---
function initXHR(ch) {
    channelName = ch;

    sendButton.onclick = () => {
        const msg = dataChannelSend.value;
        fetch(`/xhrSend?channel=${channelName}&message=${msg}`);
        appendChat('Moi: ' + msg);
        dataChannelSend.value = '';
    };

    setInterval(() => {
        fetch(`/xhrJoin?channel=${channelName}`)
            .then(res => res.json())
            .then(data => { if (data.message) appendChat('Peer: ' + data.message); });
    }, 1000);
}

// --- Join button ---
joinBtn.onclick = () => {
    const tech = techSelect.value;
    const ch = prompt('Nom du channel :');
    if (!ch) return;

    if (tech === 'socketio') initSocketIO(ch);
    else if (tech === 'ws') initWebSocket(ch);
    else initXHR(ch);
};
