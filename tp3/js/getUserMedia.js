
const constraints = { 
    audio: true, 
    video: { width: 640, height: 480 }
};


const video = document.getElementById('localVideo');


function successCallback(stream) {
    video.srcObject = stream;
    console.log("Flux local capturé avec succès");
}


function errorCallback(error) {
    console.error("Erreur getUserMedia: ", error);
}

navigator.mediaDevices.getUserMedia(constraints)
    .then(successCallback)
    .catch(errorCallback);
