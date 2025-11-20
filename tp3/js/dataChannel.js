let localPeerConnection, remotePeerConnection;
let sendChannel, receiveChannel;

const startButton = document.getElementById("startButton");
const sendButton = document.getElementById("sendButton");
const closeButton = document.getElementById("closeButton");
const dataChannelSend = document.getElementById("dataChannelSend");
const dataChannelReceive = document.getElementById("dataChannelReceive");

sendButton.disabled = true;
closeButton.disabled = true;

startButton.onclick = createConnection;
sendButton.onclick = sendData;
closeButton.onclick = closeDataChannels;

function log(text) {
    console.log(text);
}

/* ----------------------------------------------------
   1) CREATION DES DEUX PEER-CONNECTIONS
---------------------------------------------------- */
function createConnection() {
    const servers = null;

    // Local Peer
    localPeerConnection = new RTCPeerConnection(servers);
    log("Local PeerConnection created.");

    // DataChannel du local
    sendChannel = localPeerConnection.createDataChannel("sendDataChannel");
    sendChannel.onopen = handleSendChannelStateChange;
    sendChannel.onclose = handleSendChannelStateChange;

    // ICE local → remote
    localPeerConnection.onicecandidate = event => {
        if (event.candidate) {
            remotePeerConnection.addIceCandidate(event.candidate);
        }
    };

    // Remote Peer
    remotePeerConnection = new RTCPeerConnection(servers);
    log("Remote PeerConnection created.");

    // ICE remote → local
    remotePeerConnection.onicecandidate = event => {
        if (event.candidate) {
            localPeerConnection.addIceCandidate(event.candidate);
        }
    };

    // Réception DataChannel
    remotePeerConnection.ondatachannel = event => {
        receiveChannel = event.channel;
        receiveChannel.onmessage = handleMessage;
        receiveChannel.onopen = handleReceiveChannelStateChange;
        receiveChannel.onclose = handleReceiveChannelStateChange;
    };

    // Offer
    localPeerConnection.createOffer().then(offer => {
        localPeerConnection.setLocalDescription(offer);
        remotePeerConnection.setRemoteDescription(offer);

        remotePeerConnection.createAnswer().then(answer => {
            remotePeerConnection.setLocalDescription(answer);
            localPeerConnection.setRemoteDescription(answer);
        });
    });

    startButton.disabled = true;
    closeButton.disabled = false;
}

/* ----------------------------------------------------
   2) ENVOYER LES DONNÉES
---------------------------------------------------- */
function sendData() {
    const data = dataChannelSend.value;
    sendChannel.send(data);
    dataChannelSend.value = "";
}

/* ----------------------------------------------------
   3) FERMETURE
---------------------------------------------------- */
function closeDataChannels() {
    sendChannel.close();
    receiveChannel.close();
    localPeerConnection.close();
    remotePeerConnection.close();

    sendChannel = null;
    receiveChannel = null;

    startButton.disabled = false;
    sendButton.disabled = true;
    closeButton.disabled = true;

    dataChannelSend.disabled = true;
    dataChannelReceive.value = "";
}

/* ----------------------------------------------------
   4) EVENTS
---------------------------------------------------- */
function handleMessage(event) {
    dataChannelReceive.value = event.data;
}

function handleSendChannelStateChange() {
    if (sendChannel.readyState === "open") {
        dataChannelSend.disabled = false;
        sendButton.disabled = false;
    } else {
        dataChannelSend.disabled = true;
        sendButton.disabled = true;
    }
}

function handleReceiveChannelStateChange() {
    console.log("Receive channel state: " + receiveChannel.readyState);
}
