let localStream;
const peers = {}; // stocke RTCPeerConnections par peerId
let ws;
let myId;

// Obtenir média local (cam + micro)
async function startLocalMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const videoEl = document.getElementById('localVideo');
    videoEl.srcObject = localStream;
    videoEl.play();
  } catch (err) {
    console.error('Erreur getUserMedia:', err);
  }
}

// Connexion WebSocket
function connectWebSocket(channelName) {
  ws = new WebSocket('ws://localhost:8181');

  ws.onopen = () => {
    console.log('Connected to WebSocket server');
    ws.send(JSON.stringify({ type: 'join', channel: channelName }));
  };

  ws.onmessage = async (event) => {
    const data = JSON.parse(event.data);

    switch (data.type) {
      case 'joined':
        console.log('Joined channel', data.channel);
        myId = generateId();
        break;

      case 'peerJoined':
        console.log('New peer joined channel');
        await createOfferForNewPeer(data.peerId);
        break;

      case 'offer':
        await handleOffer(data.offer, data.peerId);
        break;

      case 'answer':
        await handleAnswer(data.answer, data.peerId);
        break;

      case 'ice':
        await handleIceCandidate(data.candidate, data.peerId);
        break;

      case 'message':
        appendMessage(`Peer: ${data.message}`);
        break;

      case 'Bye':
        removePeer(data.peerId);
        break;
    }
  };

  ws.onclose = () => console.log('WebSocket disconnected');
}

// Créer RTCPeerConnection pour nouveau pair
async function createOfferForNewPeer(peerId) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send(JSON.stringify({ type: 'ice', candidate: event.candidate, peerId }));
    }
  };

  pc.ontrack = (event) => addRemoteStream(peerId, event.streams[0]);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  peers[peerId] = pc;
  ws.send(JSON.stringify({ type: 'offer', offer, peerId }));
}

// Réception d’une offre
async function handleOffer(offer, peerId) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send(JSON.stringify({ type: 'ice', candidate: event.candidate, peerId }));
    }
  };

  pc.ontrack = (event) => addRemoteStream(peerId, event.streams[0]);

  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  peers[peerId] = pc;
  ws.send(JSON.stringify({ type: 'answer', answer, peerId }));
}

// Réception d’une réponse
async function handleAnswer(answer, peerId) {
  const pc = peers[peerId];
  if (!pc) return;
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
}

// Gestion ICE candidates
async function handleIceCandidate(candidate, peerId) {
  const pc = peers[peerId];
  if (!pc) return;
  await pc.addIceCandidate(new RTCIceCandidate(candidate));
}

// Ajouter flux vidéo distant
function addRemoteStream(peerId, stream) {
  let videoEl = document.getElementById(`remoteVideo-${peerId}`);
  if (!videoEl) {
    videoEl = document.createElement('video');
    videoEl.id = `remoteVideo-${peerId}`;
    videoEl.autoplay = true;
    videoEl.playsInline = true;
    document.getElementById('remoteVideos').appendChild(videoEl);
  }
  videoEl.srcObject = stream;
}

// Supprimer peer
function removePeer(peerId) {
  if (peers[peerId]) {
    peers[peerId].close();
    delete peers[peerId];
  }
  const videoEl = document.getElementById(`remoteVideo-${peerId}`);
  if (videoEl) videoEl.remove();
}

// Envoyer message texte
function sendMessage() {
  const msgInput = document.getElementById('msgInput');
  const msg = msgInput.value;
  if (msg && ws) {
    ws.send(JSON.stringify({ type: 'message', message: msg }));
    appendMessage(`Moi: ${msg}`);
    msgInput.value = '';
  }
}

// Afficher messages
function appendMessage(msg) {
  const chat = document.getElementById('chat');
  const p = document.createElement('p');
  p.textContent = msg;
  chat.appendChild(p);
}

// Générer un ID aléatoire pour peer
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}
