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

                    const { command } = messageData;

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