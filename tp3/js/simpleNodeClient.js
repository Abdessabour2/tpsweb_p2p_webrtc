const startButton = document.getElementById('startButton');
const sendButton = document.getElementById('sendButton');
const dataChannelSend = document.getElementById('dataChannelSend');
const dataChannelReceive = document.getElementById('dataChannelReceive');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

let pc, localStream, dataChannel, socket;
let channel = prompt("Entrez le nom du canal :");
const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// Use native WebSocket signaling (server ws runs on ws://localhost:8182)
socket = new WebSocket('ws://localhost:8182');

socket.addEventListener('open', () => {
    socket.send(JSON.stringify({ type: 'join', room: channel }));
});

socket.addEventListener('message', async (evt) => {
    const data = JSON.parse(evt.data);

    if (data.type === 'joined') {
        console.log('Canal créé / rejoint:', channel);
        // Prepare local stream
        await startLocalStream();
    }

    if (data.type === 'peer-join') {
        // Another peer joined — if we are the first, start as initiator
        console.log('Un pair a rejoint');
        createPeerConnection(true);
    }

    if (data.type === 'signal') {
        const message = data.message;
        if (message.sdp) {
            await pc.setRemoteDescription(message.sdp);
            if (message.sdp.type === 'offer') {
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.send(JSON.stringify({ type: 'signal', message: { sdp: pc.localDescription } }));
            }
        } else if (message.candidate) {
            await pc.addIceCandidate(message.candidate);
        }
    }
});

async function startLocalStream(){
    try{
        localStream = await navigator.mediaDevices.getUserMedia({ video:true, audio:true });
        localVideo.srcObject = localStream;
    }catch(e){ console.error(e); }
}

function createPeerConnection(isInitiator){
    pc = new RTCPeerConnection(configuration);

   
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));


    pc.ontrack = e => remoteVideo.srcObject = e.streams[0];


    pc.onicecandidate = e => {
        if (e.candidate) socket.send(JSON.stringify({ type: 'signal', message: { candidate: e.candidate } }));
    };


    if(isInitiator){
        dataChannel = pc.createDataChannel("chat");
        setupDataChannel();
        createOffer();
    } else {
        pc.ondatachannel = e => {
            dataChannel = e.channel;
            setupDataChannel();
        };
    }
}

function setupDataChannel(){
    dataChannel.onopen = () => {
        sendButton.disabled = false;
        dataChannelSend.disabled = false;
    };
    dataChannel.onmessage = e => {
        dataChannelReceive.value += "Peer: " + e.data + "\n";
    };
}

function createOffer(){
        pc.createOffer()
            .then(offer => pc.setLocalDescription(offer))
            .then(() => socket.send(JSON.stringify({ type: 'signal', message: { sdp: pc.localDescription } })));
}


sendButton.onclick = () => {
    const msg = dataChannelSend.value.trim();
    if(msg){
        dataChannel.send(msg);
        dataChannelReceive.value += "Vous: " + msg + "\n";
        dataChannelSend.value = '';
    }
};
