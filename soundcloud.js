(function() {
  // Check if already initialized
  if (window.requestPlusInitialized) {
    console.log("RequestPlus|Already initialized");
    return;
  }
  window.requestPlusInitialized = true;

  let songinfostate;
  let songinfocurrentdur;
  let songinfoenddur;
  let songinfocursongtitle;
  let songinfocursongcoverurl;
  let songinfoartist;
  let songinfocurrentsongurl;
  let songinfocurrentsongliked;
  let songinfovolume;

  /**
   * Delay utility function
   * @param {number} ms - The number of milliseconds to delay
   * @returns {Promise<void>} - Resolves after the specified delay
   */
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /**
   * Get current volume from SoundCloud player
   */
  function getVolume() {
    try {
      var volumeSlider = document.querySelector(".volume__sliderWrapper");
      if (volumeSlider) {
        var volumeValue = parseFloat(volumeSlider.getAttribute("aria-valuenow"));
        return volumeValue;
      }
      return 1; // Default to max volume if not found
    } catch (error) {
      console.error("RequestPlus|Error getting volume:", error);
      return 1;
    }
  }

  /**
   * Set volume in SoundCloud player
   * @param {number} volume - Volume level between 0 and 1
   */
  function setVolume(volume) {
    try {
      // Clamp volume between 0 and 1
      volume = Math.max(0, Math.min(1, volume));
      var volumeConbtainer = document.querySelector(".volume");
        
      
      var volumeSlider = document.querySelector(".volume__sliderWrapper");
      if (volumeSlider) {
        // Calculate the height of the slider (assuming 130px total height based on the calculation)
        var sliderHeight = 130; // This might need adjustment based on actual slider height
        var handlePosition = sliderHeight - (volume * sliderHeight);
        var progressHeight = volume * sliderHeight;
        
        // Update the slider elements
        var sliderProgress = document.querySelector(".volume__sliderProgress");
        var sliderHandle = document.querySelector(".volume__sliderHandle");
        
        if (sliderProgress) {
          sliderProgress.style.height = progressHeight + "px";
        }
        
        if (sliderHandle) {
          sliderHandle.style.top = handlePosition + "px";
        }
        
        // Update aria attribute
        volumeSlider.setAttribute("aria-valuenow", volume);
        if (volumeConbtainer) {
            // because this data attribute is used to reflect volume level in code, make this a whole number of the volume object of 1-10
            volumeConbtainer.setAttribute("data-level", Math.round(volume * 10));
        }
        
        // Trigger a click event to actually change the volume

        
        console.log("RequestPlus|Volume set to:", volume);
        return true;
      }
      return false;
    } catch (error) {
      console.error("RequestPlus|Error setting volume:", error);
      return false;
    }
  }

  /**
   * Collect current song information from SoundCloud DOM
   */
  function collectSongInfo() {
    try {
      var playbtn = document.querySelector(".playControls__elements .playControl");
      var endduration = document.querySelectorAll(".playbackTimeline__duration span")[1];
      var currentduration = document.querySelectorAll(".playbackTimeline__timePassed span")[1];
      var currentsongtitle = document.querySelector(".playbackSoundBadge__title");
      
      var coverElement = document.querySelector(".playControls__soundBadge .image__lightOutline span");
      if (!coverElement) return false;
      
      var currentsongcover = coverElement
        .getAttribute("style")
        .split(";")[0]
        .split('"')[1]
        .replace("120x120", "500x500");
      
      songinfocurrentsongurl = document
        .querySelector(".playbackSoundBadge__titleLink")
        .getAttribute("href");
      
      var currentartist = document.querySelector(".playbackSoundBadge__lightLink");
      var currentsongliked = document.querySelector(".playbackSoundBadge__actions .playbackSoundBadge__like");
      
      if (currentsongliked && currentsongliked.getAttribute("title") == "Unlike") {
        songinfocurrentsongliked = true;
      } else {
        songinfocurrentsongliked = false;
      }
      
      songinfocurrentdur = currentduration.innerText;
      songinfoenddur = endduration.innerText;
      songinfocursongtitle = currentsongtitle.innerText.split("\n")[1];
      songinfocursongcoverurl = currentsongcover;
      songinfoartist = currentartist.innerText;
      songinfovolume = getVolume();
      
      if (playbtn.classList.contains("playing")) {
        songinfostate = "playing";
      } else {
        songinfostate = "paused";
      }
      
      return true;
    } catch (error) {
      console.error("RequestPlus|Error collecting song info:", error);
      return false;
    }
  }

  /**
   * Send current track info to WebSocket server
   */
  function sendCurrentTrack(ws) {
    if (collectSongInfo()) {
      ws.send(
        JSON.stringify({
          command: "currentTrack",
          data: {
            title: songinfocursongtitle,
            artist: songinfoartist,
            album_art_url: songinfocursongcoverurl,
            url: songinfocurrentsongurl,
            current_time: songinfocurrentdur,
            duration_time: songinfoenddur
          },
          isPlaying: songinfostate === "playing",
          isLiked: songinfocurrentsongliked,
          volume: songinfovolume
        })
      );
    }
  }

  /**
   * Initializes the WebSocket client to connect to a server on port 443.
   */
  const initializePlaybackAPI = async () => {
    const delayTime = 200;
    await delay(delayTime);

    let ws;
    const connect = async () => {
      ws = new WebSocket("ws://localhost:443");
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        console.log("RequestPlus|Connected to WebSocket server");
        sendCurrentTrack(ws);
      };

      ws.onmessage = async (event) => {
        try {
          let messageData = event.data;

          // Check if the message is binary data (ArrayBuffer)
          if (messageData instanceof ArrayBuffer) {
            const decoder = new TextDecoder("utf-8");
            const textData = decoder.decode(messageData);
            messageData = JSON.parse(textData);
          } else {
            messageData = JSON.parse(messageData);
          }

          const { command, welcome } = messageData;
          
          if (welcome) {
            ws.send(JSON.stringify({ 
              command: "identify", 
              type: "soundcloud", 
              version: "1.0.0" 
            }));
            console.log("RequestPlus|Identified to server");
            return; // Don't process as a command
          }

          // Only log and process actual commands
          console.log("RequestPlus|Received command:", command);

          switch (command) {
            case "PlayPause":
              var playbtn = document.querySelector(".playControls__elements .playControl");
              if (playbtn) playbtn.click();
              await delay(10);
              sendCurrentTrack(ws);
              break;

            case "Next":
              var nextbtn = document.querySelector(".playControls__elements .skipControl__next");
              if (nextbtn) nextbtn.click();
              await delay(100);
              sendCurrentTrack(ws);
              break;

            case "Prev":
              var prevbtn = document.querySelector(".playControls__elements .skipControl__previous");
              if (prevbtn) prevbtn.click();
              await delay(100);
              sendCurrentTrack(ws);
              break;

            case "getdata":
              sendCurrentTrack(ws);
              break;

            case "like":
              var likebtn = document.querySelector(".playbackSoundBadge__actions .playbackSoundBadge__like");
              if (likebtn) likebtn.click();
              await delay(50);
              sendCurrentTrack(ws);
              break;

            case "volume":
              if (messageData.data && typeof messageData.data.volume === "number") {
                var newVolume = messageData.data.volume;
                console.log("RequestPlus|Setting volume to:", newVolume);
                if (setVolume(newVolume)) {
                  await delay(50);
                  sendCurrentTrack(ws);
                } else {
                  ws.send(
                    JSON.stringify({
                      command: "error",
                      data: "Failed to set volume."
                    })
                  );
                }
              } else {
                console.warn("RequestPlus|Invalid volume data provided");
                ws.send(
                  JSON.stringify({
                    command: "error",
                    data: "Invalid volume provided in volume command. Expected data.volume as a number between 0 and 1."
                  })
                );
              }
              break;

            default:
              console.warn("RequestPlus|Unknown command received:", command);
          }
        } catch (error) {
          console.error("RequestPlus|Error processing WebSocket message:", error);
        }
      };

      ws.onclose = async () => {
        console.log("RequestPlus|Disconnected from WebSocket server. Attempting to reconnect in 2 seconds...");
        await delay(2000);
        connect();
      };

      ws.onerror = (error) => {
        console.error("RequestPlus|WebSocket encountered an error:", error);
      };
    };

    connect();
  };

  // Start the WebSocket connection
  (async () => {
    await initializePlaybackAPI();
  })();

  console.log("RequestPlus|Integration loaded and initialized");
})();