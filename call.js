const socket = io("http://192.168.10.159:4000", {
  auth: {
    token:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAZ21haWwuY29tIiwic3ViIjoiY202cmVhcjE5MDAwMHd2d2dmOGhtdjBiaCIsImlhdCI6MTczODcyODkyNSwiZXhwIjoxNzM4ODE1MzI1fQ.wBv6We8hcZfyRa23j2cWsPPsdfQZ_wMKH6BQAQ1fQzs",
  },
});
let localStream, peerConnection;
const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }, // STUN for public IP discovery
    // {
    //   urls: "turn:your-turn-server.com:3478", // TURN for relaying
    //   username: "user",
    //   credential: "password",
    // },
  ],
};

async function requestMicrophoneAccess() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("Your browser does not support microphone access.");
    console.error("navigator.mediaDevices.getUserMedia is not available.");
    return;
  }

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // alert("Microphone access granted.");
  } catch (error) {
    // alert("Microphone access is required to make a call.");
    console.error("Error accessing microphone:", error);
  }
}

function join() {
  // const username = document.getElementById("username").value;
  requestMicrophoneAccess();
  // socket.emit("join", { username });
}

async function call(receiver_id) {
  const callTo = receiver_id;
  peerConnection = new RTCPeerConnection(config);
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("iceCandidate", {
        receiver: callTo,
        candidate: event.candidate,
      });
    }
  };
  peerConnection.ontrack = (event) => {
    let audio = document.createElement("audio");
    audio.srcObject = event.streams[0];
    document.body.appendChild(audio);
    audio.play();
  };
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  localStream
    .getTracks()
    .forEach((track) => peerConnection.addTrack(track, localStream));

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("call", {
    caller: document.getElementById("username").value,
    receiver: callTo,
    offer,
  });
}

function endCall(receiver_id) {
  peerConnection.close();
  socket.emit("endCall", { receiver: receiver_id });
}

function cleanUp() {
  socket.off("incomingCall");
  socket.off("callAccepted");
  socket.off("iceCandidate");
}

function listen() {
  socket.on("incomingCall", async ({ caller, offer }) => {
    peerConnection = new RTCPeerConnection(config);
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("iceCandidate", {
          receiver: caller,
          candidate: event.candidate,
        });
      }
    };
    peerConnection.ontrack = (event) => {
      let audio = document.createElement("audio");
      audio.srcObject = event.streams[0];
      document.body.appendChild(audio);
      audio.play();
    };
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream
      .getTracks()
      .forEach((track) => peerConnection.addTrack(track, localStream));

    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("answer", {
      caller,
      receiver: document.getElementById("username").value,
      answer,
    });
  });

  socket.on("callAccepted", async ({ answer }) => {
    await peerConnection.setRemoteDescription(answer);
  });

  socket.on("iceCandidate", ({ candidate }) => {
    peerConnection.addIceCandidate(candidate);
  });
}
