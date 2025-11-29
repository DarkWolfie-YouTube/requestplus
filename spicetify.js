var requestplus = (() => {
    /**
     * Delay utility function
     * @param {number} ms - The number of milliseconds to delay
     * @returns {Promise<void>} - Resolves after the specified delay
     */
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    /**
     * Initializes the WebSocket client to connect to a server on port 443.
     */
    const initializePlaybackAPI = async () => {
        const delayTime = 200; // Delay time before initializing
        await delay(delayTime);

        let ws;
        const connect = async () => {
            ws = new WebSocket("ws://localhost:443");
            ws.binaryType = "arraybuffer"; // Set binary type to handle ArrayBuffer

            ws.onopen = () => {
                console.log("Connected to WebSocket server");
                ws.send(
                    JSON.stringify({
                        command: "currentTrack",
                        data: Spicetify.Queue.track.contextTrack.metadata,
                        isPlaying: Spicetify.Player.isPlaying(),
                    })
                );
            };

            ws.onmessage = async (event) => {
                try {
                    let messageData = event.data;

                    // Check if the message is binary data (ArrayBuffer)
                    if (messageData instanceof ArrayBuffer) {
                        const decoder = new TextDecoder("utf-8");
                        const textData = decoder.decode(messageData); // Decode ArrayBuffer to string
                        messageData = JSON.parse(textData); // Parse the decoded text as JSON
                    } else {
                        // If it's not binary, process as usual (JSON string)
                        messageData = JSON.parse(messageData);
                    }

                    const { command, welcome } = messageData;
                    if (welcome) {
                        ws.send(JSON.stringify({ command: "identify", type: "spotify", version: "1.0.3" }));
                    }
                    switch (command) {
                    
                        case "PlayPause":
                            Spicetify.Player.togglePlay();
                            await delay(10);
                            ws.send(
                                JSON.stringify({
                                    command: "currentTrack",
                                    data: Spicetify.Queue.track.contextTrack.metadata,
                                    isPlaying: Spicetify.Player.isPlaying(),
                                    progress: Spicetify.Player.getProgress(),
                                    volume: Spicetify.Player.getVolume(),
                                    shuffle: Spicetify.Player.getShuffle(),
                                    repeat: Spicetify.Player.getRepeat(),
                                    isLiked: Spicetify.Player.getHeart(),
                                    id: Spicetify.Queue.track.contextTrack.uri
                                })
                            );
                            break;

                        case "Next":
                            Spicetify.Player.next();
                            ws.send(
                                JSON.stringify({
                                    command: "currentTrack",
                                    data: Spicetify.Queue.nextTracks[0].contextTrack.metadata,
                                    isPlaying: Spicetify.Player.isPlaying(),
                                    progress: 0,
                                    volume: Spicetify.Player.getVolume(),
                                    shuffle: Spicetify.Player.getShuffle(),
                                    repeat: Spicetify.Player.getRepeat(),
                                    isLiked: Spicetify.Player.getHeart(),
                                    id: Spicetify.Queue.track.contextTrack.uri
                                })
                            );
                            break;

                        case "Prev":
                            Spicetify.Player.back();
                            ws.send(
                                JSON.stringify({
                                    command: "currentTrack",
                                    data: Spicetify.Queue.track.contextTrack.metadata,
                                    isPlaying: Spicetify.Player.isPlaying(),
                                    progress: 0,
                                    volume: Spicetify.Player.getVolume(),
                                    shuffle: Spicetify.Player.getShuffle(),
                                    repeat: Spicetify.Player.getRepeat(),
                                    isLiked: Spicetify.Player.getHeart(),
                                    id: Spicetify.Queue.track.contextTrack.uri
                                })
                            );
                            break;

                        case "Shuffle":
                            Spicetify.Player.toggleShuffle();
                            ws.send(
                                JSON.stringify({
                                    command: "currentTrack",
                                    data: Spicetify.Queue.track.contextTrack.metadata,
                                    isPlaying: Spicetify.Player.isPlaying(),
                                    progress: Spicetify.Player.getProgress(),
                                    volume: Spicetify.Player.getVolume(),
                                    shuffle: Spicetify.Player.getShuffle(),
                                    repeat: Spicetify.Player.getRepeat(),
                                    isLiked: Spicetify.Player.getHeart(),
                                    id: Spicetify.Queue.track.contextTrack.uri
                                })
                            );
                            break;

                        case "Repeat":
                            Spicetify.Player.toggleRepeat();
                            ws.send(
                                JSON.stringify({
                                    command: "currentTrack",
                                    data: Spicetify.Queue.track.contextTrack.metadata,
                                    isPlaying: Spicetify.Player.isPlaying(),
                                    progress: Spicetify.Player.getProgress(),
                                    volume: Spicetify.Player.getVolume(),
                                    shuffle: Spicetify.Player.getShuffle(),
                                    repeat: Spicetify.Player.getRepeat(),
                                    isLiked: Spicetify.Player.getHeart(),
                                    id: Spicetify.Queue.track.contextTrack.uri
                                })
                            );
                            break;

                        case "getdata":
                            ws.send(
                                JSON.stringify({
                                    command: "currentTrack",
                                    data: Spicetify.Queue.track.contextTrack.metadata,
                                    isPlaying: Spicetify.Player.isPlaying(),
                                    progress: Spicetify.Player.getProgress(),
                                    volume: Spicetify.Player.getVolume(),
                                    shuffle: Spicetify.Player.getShuffle(),
                                    repeat: Spicetify.Player.getRepeat(),
                                    isLiked: Spicetify.Player.getHeart(),
                                    id: Spicetify.Queue.track.contextTrack.uri
                                })
                            );
                            break;
                        
                        case "addTrack":
                            if (messageData.data) {
                                if (messageData.data.uri) {
                                    Spicetify.addToQueue([{ uri: messageData.data.uri }]);
                                    ws.send(
                                        JSON.stringify({
                                            command: "currentTrack",
                                            data: Spicetify.Queue.track.contextTrack.metadata,
                                            isPlaying: Spicetify.Player.isPlaying(),
                                            progress: Spicetify.Player.getProgress(),
                                            volume: Spicetify.Player.getVolume(),
                                            shuffle: Spicetify.Player.getShuffle(),
                                            repeat: Spicetify.Player.getRepeat(),
                                            isLiked: Spicetify.Player.getHeart(),
                                            id: Spicetify.Queue.track.contextTrack.uri
                                        })
                                    );
                                    let newURI = messageData.data.uri.replace("spotify:track:", "");
                                    let deta = await Spicetify.CosmosAsync.get('https://api.spotify.com/v1/tracks/' + newURI)
                                    await ws.send(JSON.stringify({
                                        command: "requestHandled",
                                        data: deta
                                    }))
                                } else {
                                    console.warn("No URI provided in addTrack command.");
                                    ws.send(
                                        JSON.stringify({
                                            command: "error",
                                            data: "No URI provided in addTrack command.",
                                        })
                                    )
                                } 
                            } else {
                                console.warn("No data provided in addTrack command.");
                                ws.send(
                                    JSON.stringify({
                                        command: "error",
                                        data: "No data provided in addTrack command. Please pass a data element.",
                                    })
                                )
                            }
                            break;
                        case "seek":
                            if (messageData.data) {
                                const newTime = messageData.data.position;
                                console.log("Seeking to time:", newTime);
                                if (typeof newTime === "number") {
                                    Spicetify.Player.seek(newTime);
                                } else {
                                    console.warn("Invalid TIME provided in seek command.");
                                    ws.send(
                                        JSON.stringify({
                                            command: "error",
                                            data: "Invalid time provided in seek command.",
                                        })
                                    );
                                }
                            } else {
                                console.warn("No data provided in seek command.");
                                ws.send(
                                    JSON.stringify({
                                        command: "error",
                                        data: "No data provided in seek command. Please pass a data element.",
                                    })
                                );
                            }
                            break;
                        case "like":
                            if (Spicetify.Player.getHeart() == true){
                                Spicetify.Player.setHeart(false);
                            } else {
                                Spicetify.Player.setHeart(true);
                            }
                            break;
                        case "shuffle":
                            if (Spicetify.Player.getShuffle() == true){
                                Spicetify.Player.setShuffle(false);
                            } else {
                                Spicetify.Player.setShuffle(true);
                            }
                            break;
                        case "repeat":
                            if (Spicetify.Player.getRepeat() == 1){
                                Spicetify.Player.setRepeat(2);
                            } else if (Spicetify.Player.getRepeat() == 2) {
                                Spicetify.Player.setRepeat(0);
                            } else {
                                Spicetify.Player.setRepeat(1);
                            }
                            break;
                        case "volume": 
                            if (messageData.data) {
                                const newVolume = messageData.data.volume;
                                console.log(newVolume);
                                if (typeof newVolume === "number") {
                                    Spicetify.Player.setVolume(newVolume);
                                } else {
                                    console.warn("Invalid volume provided in volume command.");
                                    ws.send(
                                        JSON.stringify({
                                            command: "error",
                                            data: "Invalid volume provided in volume command.",
                                        })
                                    );
                                }
                            } else {
                                console.warn("No data provided in volume command.");
                                ws.send(
                                    JSON.stringify({
                                        command: "error",
                                        data: "No data provided in volume command. Please pass a data element.",
                                    })
                                );
                            }
                            break;
                        case "getInfo":
                            let newURI = messageData.data.uri.replace("spotify:track:", "");
                            let deta = await Spicetify.CosmosAsync.get('https://api.spotify.com/v1/tracks/' + newURI)
                            await ws.send(JSON.stringify({
                                command: "requestHandled",
                                data: deta
                            }))
                        default:
                            console.warn("Unknown command received:", command);
                    }
                } catch (error) {
                    console.error("Error processing WebSocket message:", error);
                }
            };

            ws.onclose = async () => {
                console.log("Disconnected from WebSocket server. Attempting to reconnect in 2 seconds...");
                await delay(2000);
                connect(); // Attempt to reconnect
            };

            ws.onerror = (error) => {
                console.error("WebSocket encountered an error:", error);
            };
        };

        connect(); // Initial connection attempt
    };

    (async () => {
        await initializePlaybackAPI();
    })();
})();