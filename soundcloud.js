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
  let songinforepeat;

  /**
   * Delay utility function
   * @param {number} ms - The number of milliseconds to delay
   * @returns {Promise<void>} - Resolves after the specified delay
   */
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /**
   * Get current volume from SoundCloud player
   */
  function getAudio() {
    return document.querySelector("audio");
  }

  function parseTimeToMs(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (!value || typeof value !== "string") return 0;
    const parts = value.trim().split(":").map((part) => Number.parseInt(part, 10) || 0);
    if (parts.length === 3) return ((parts[0] * 3600) + (parts[1] * 60) + parts[2]) * 1000;
    if (parts.length === 2) return ((parts[0] * 60) + parts[1]) * 1000;
    return parts[0] * 1000;
  }

  function getAbsoluteSoundCloudUrl(url) {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    return new URL(url, window.location.origin).toString();
  }

  function cleanSoundCloudTitle(value) {
    if (!value) return "";
    let title = String(value)
      .replace(/\s+/g, " ")
      .replace(/^(Current track:|Playing:)\s*/i, "")
      .trim();

    const prefixedAgain = title.match(/Current track:\s*(.+)$/i);
    if (prefixedAgain) {
      title = prefixedAgain[1].trim();
    }

    if (title.length % 2 === 0) {
      const half = title.slice(0, title.length / 2);
      if (half && half === title.slice(title.length / 2)) {
        title = half;
      }
    }
    return title.trim();
  }

  function getTitleFromElement(element) {
    if (!element) return "";
    return cleanSoundCloudTitle(
      element.getAttribute("title") ||
      element.getAttribute("aria-label") ||
      element.textContent ||
      ""
    );
  }

  function getBackgroundImageUrl(element) {
    if (!element) return "";
    const style = element.getAttribute("style") || "";
    const match = style.match(/url\(["']?([^"')]+)["']?\)/i);
    return match ? match[1].replace("t50x50", "t500x500").replace("120x120", "500x500") : "";
  }

  function normalizeSoundCloudPath(url) {
    try {
      const parsed = new URL(getAbsoluteSoundCloudUrl(url));
      return `${parsed.hostname}${parsed.pathname}`.replace(/\/$/, "").toLowerCase();
    } catch {
      return "";
    }
  }

  function urlsMatch(left, right) {
    const leftPath = normalizeSoundCloudPath(left);
    const rightPath = normalizeSoundCloudPath(right);
    return Boolean(leftPath && rightPath && leftPath === rightPath);
  }

  function getTrackRows() {
    return [
      ...document.querySelectorAll(
        ".soundBadge.m-playable, .soundBadgeList__item, .systemPlaylistTile.playableTile, .trackItem, .compactTrackList__item"
      )
    ];
  }

  function getTrackInfoFromRow(row) {
    if (!row) return null;
    const titleLink = row.querySelector(".soundTitle__title, .playableTile__heading, a[href*='/'][title]");
    const artistLink = row.querySelector(".soundTitle__username, .playableTile__mainHeading + a, a[href*='soundcloud.com/']");
    const artworkElement = row.querySelector(".image__lightOutline span, .playableTile__artwork span, span[style*='sndcdn.com']");
    const title = getTitleFromElement(titleLink);
    const url = getAbsoluteSoundCloudUrl(titleLink?.getAttribute("href"));
    if (!title || !url) return null;
    return {
      id: url,
      title,
      artist: artistLink?.textContent?.trim() || "",
      url,
      image: getBackgroundImageUrl(artworkElement),
      isPlaying: row.classList.contains("active") || Boolean(row.querySelector(".sc-button-pause"))
    };
  }

  function collectVisibleTracks() {
    return getTrackRows()
      .map(getTrackInfoFromRow)
      .filter(Boolean)
      .filter((track, index, tracks) => tracks.findIndex((item) => item.url === track.url) === index)
      .slice(0, 50);
  }

  function findTrackRow(url) {
    const targetUrl = getAbsoluteSoundCloudUrl(url);
    return getTrackRows().find((row) => {
      const links = [...row.querySelectorAll("a[href]")];
      return links.some((link) => urlsMatch(link.getAttribute("href"), targetUrl));
    });
  }

  function getMenuItems() {
    return [
      ...document.querySelectorAll(
        ".modalMenu button, .modalMenu a, .dropdownContent button, .dropdownContent a, .sc-button-dropdown button, .sc-button-dropdown a, [role='menuitem']"
      )
    ];
  }

  async function clickTrackMenuAction(row, matcher) {
    const moreButton = row?.querySelector(".sc-button-more, button[title='More'], button[aria-label='More']");
    if (!moreButton) return false;

    moreButton.click();
    await delay(150);

    const menuItem = getMenuItems().find((item) => {
      const label = `${item.textContent || ""} ${item.getAttribute("title") || ""} ${item.getAttribute("aria-label") || ""}`.trim();
      return matcher.test(label);
    });

    if (!menuItem) {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return false;
    }

    menuItem.click();
    return true;
  }

  function getVolume() {
    try {
      const audio = getAudio();
      if (audio) return audio.volume;

      var volumeSlider = document.querySelector(".volume__sliderWrapper");
      if (volumeSlider) {
        var volumeValue = parseFloat(volumeSlider.getAttribute("aria-valuenow"));
        return volumeValue > 1 ? volumeValue / 100 : volumeValue;
      }
      return 1; // Default to max volume if not found
    } catch (error) {
      console.error("RequestPlus|Error getting volume:", error);
      return 1;
    }
  }

  function dispatchPointerMouseEvent(element, type, clientX, clientY) {
    if (!element) return;
    const options = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX,
      clientY,
      buttons: type === "mouseup" || type === "pointerup" ? 0 : 1,
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true
    };

    if (window.PointerEvent && type.startsWith("pointer")) {
      element.dispatchEvent(new PointerEvent(type, options));
      return;
    }

    if (!type.startsWith("pointer")) {
      element.dispatchEvent(new MouseEvent(type, options));
    }
  }

  function getInternalEventProps(element) {
    if (!element) return null;
    const internalKey = Object.keys(element).find((key) =>
      key.startsWith("__reactProps$") ||
      key.startsWith("__reactEventHandlers$") ||
      key.startsWith("__reactFiber$")
    );

    if (!internalKey) return null;

    const internalValue = element[internalKey];
    return internalValue?.memoizedProps || internalValue || null;
  }

  function createSoundCloudVolumeEvent(element, volume) {
    const rail = document.querySelector(".volume__sliderBackground") || element;
    const rect = rail.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.bottom - (volume * rect.height);
    const nativeEvent = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX,
      clientY,
      button: 0,
      buttons: 1
    });

    return {
      target: element,
      currentTarget: element,
      nativeEvent,
      clientX,
      clientY,
      pageX: clientX + window.scrollX,
      pageY: clientY + window.scrollY,
      button: 0,
      buttons: 1,
      preventDefault: () => nativeEvent.preventDefault(),
      stopPropagation: () => nativeEvent.stopPropagation(),
      persist: () => {}
    };
  }

  function callSoundCloudVolumeHandlers(volume) {
    const elements = [
      document.querySelector(".volume__sliderHandle"),
      document.querySelector(".volume__sliderBackground"),
      document.querySelector(".volume__sliderWrapper"),
      document.querySelector(".volume")
    ].filter(Boolean);

    for (const element of elements) {
      const props = getInternalEventProps(element);
      if (!props) continue;

      const handlers = [
        props.onMouseDown,
        props.onPointerDown,
        props.onClick,
        props.onChange,
        props.onInput
      ].filter((handler) => typeof handler === "function");

      for (const handler of handlers) {
        try {
          handler(createSoundCloudVolumeEvent(element, volume));
          return true;
        } catch (error) {
          console.warn("RequestPlus|SoundCloud volume handler failed:", error);
        }
      }
    }

    return false;
  }

  function nudgeVolumeUi(volume) {
    const volumeContainer = document.querySelector(".volume");
    const volumeButton = document.querySelector(".volume__button, .volume button, .volume");
    const volumeSlider = document.querySelector(".volume__sliderWrapper, .volume__slider");
    const volumeRail = document.querySelector(".volume__sliderBackground") || volumeSlider;
    const volumeHandle = document.querySelector(".volume__sliderHandle") || volumeRail;
    if (!volumeSlider) return false;

    const hoverTarget = volumeButton || volumeContainer || volumeSlider;
    const hoverRect = hoverTarget.getBoundingClientRect();
    dispatchPointerMouseEvent(hoverTarget, "mouseover", hoverRect.left + 1, hoverRect.top + 1);
    dispatchPointerMouseEvent(hoverTarget, "mouseenter", hoverRect.left + 1, hoverRect.top + 1);

    const rect = volumeRail.getBoundingClientRect();
    if (!rect.height || !rect.width) return false;

    const x = rect.left + rect.width / 2;
    const y = rect.bottom - (volume * rect.height);
    const startRect = volumeHandle.getBoundingClientRect();
    const startX = startRect.left + startRect.width / 2;
    const startY = startRect.top + startRect.height / 2;
    const target = document.elementFromPoint(x, y) || volumeRail || volumeSlider;

    dispatchPointerMouseEvent(volumeHandle, "pointerdown", startX, startY);
    dispatchPointerMouseEvent(volumeHandle, "mousedown", startX, startY);
    dispatchPointerMouseEvent(document, "pointermove", x, y);
    dispatchPointerMouseEvent(document, "mousemove", x, y);
    dispatchPointerMouseEvent(target, "pointermove", x, y);
    dispatchPointerMouseEvent(target, "mousemove", x, y);
    dispatchPointerMouseEvent(document, "pointerup", x, y);
    dispatchPointerMouseEvent(document, "mouseup", x, y);
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y }));

    volumeSlider.setAttribute("aria-valuenow", String(volume));
    if (volumeContainer) {
      volumeContainer.setAttribute("data-level", String(Math.round(volume * 10)));
    }

    return true;
  }

  /**
   * Set volume in SoundCloud player
   * @param {number} volume - Volume level between 0 and 1
   */
  async function setVolume(volume) {
    try {
      // Clamp volume between 0 and 1
      volume = Math.max(0, Math.min(1, volume));
      const audio = getAudio();
    if (audio) {
      audio.volume = volume;
      audio.dispatchEvent(new Event("volumechange", { bubbles: true }));
    }

      if (callSoundCloudVolumeHandlers(volume)) {
        await delay(50);
        console.log("RequestPlus|Volume set through SoundCloud handler:", volume);
        return true;
      }

      if (nudgeVolumeUi(volume)) {
        await delay(50);
        console.log("RequestPlus|Volume set to:", volume);
        return true;
      }

      return Boolean(audio);
    } catch (error) {
      console.error("RequestPlus|Error setting volume:", error);
      return false;
    }
  }

  function seekTo(positionMs) {
    try {
      const audio = getAudio();
      if (!audio) return false;
      audio.currentTime = Math.max(0, positionMs / 1000);
      audio.dispatchEvent(new Event("timeupdate", { bubbles: true }));
      return true;
    } catch (error) {
      console.error("RequestPlus|Error seeking:", error);
      return false;
    }
  }

  function clickSelector(selector) {
    const element = document.querySelector(selector);
    if (!element) return false;
    element.click();
    return true;
  }

  async function addTrack(url) {
    const targetUrl = getAbsoluteSoundCloudUrl(url);
    if (!targetUrl) return false;

    const trackRow = findTrackRow(targetUrl);
    if (trackRow) {
      const queued = await clickTrackMenuAction(trackRow, /add\s+to\s+(next\s+up|queue)|play\s+next|queue/i);
      if (queued) return true;
    }

    // If the row is not mounted in the current SoundCloud view, opening the
    // URL is the safest fallback. BetterSoundCloud can still send another
    // addTrack command once SoundCloud renders the page row.
    if (window.location.href !== targetUrl) {
      window.location.href = targetUrl;
      return true;
    }

    return clickSelector(".playControls__elements .playControl, .playControl");
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
      var repeatbtn = document.querySelector(".playControls__elements .repeatControl");
      
      var coverElement = document.querySelector(".playControls__soundBadge .image__lightOutline span");
      var currentsongcover = getBackgroundImageUrl(coverElement);
      
      var titleLink = document.querySelector(".playbackSoundBadge__titleLink");
      songinfocurrentsongurl = getAbsoluteSoundCloudUrl(titleLink?.getAttribute("href"));
      
      var currentartist = document.querySelector(".playbackSoundBadge__lightLink");
      var currentsongliked = document.querySelector(".playbackSoundBadge__actions .playbackSoundBadge__like");
      var audio = getAudio();
      
      if (currentsongliked && currentsongliked.getAttribute("title") == "Unlike") {
        songinfocurrentsongliked = true;
      } else {
        songinfocurrentsongliked = false;
      }
      
      songinfocurrentdur = audio ? Math.floor(audio.currentTime * 1000) : parseTimeToMs(currentduration?.innerText || "0:00");
      songinfoenddur = audio ? Math.floor(audio.duration * 1000) : parseTimeToMs(endduration?.innerText || "0:00");
      songinfocursongtitle = getTitleFromElement(titleLink) || getTitleFromElement(currentsongtitle);
      songinfocursongcoverurl = currentsongcover;
      songinfoartist = currentartist?.innerText || "";
      songinfovolume = getVolume();
      if (repeatbtn?.classList.contains("m-none")) {
        songinforepeat = "none";
      } else if (repeatbtn?.classList.contains("m-one")) {
        songinforepeat = "one";
      } else {
        songinforepeat = "all";
      }
      
      
      if (audio ? !audio.paused : playbtn?.classList.contains("playing")) {
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
          type: "soundcloud",
          data: {
            id: songinfocurrentsongurl,
            title: songinfocursongtitle,
            artist: songinfoartist,
            album_art_url: songinfocursongcoverurl,
            image: songinfocursongcoverurl,
            url: songinfocurrentsongurl,
            current_time: songinfocurrentdur,
            duration_time: songinfoenddur,
            progress: songinfocurrentdur,
            duration: songinfoenddur,
            visible_tracks: collectVisibleTracks()
          },
          isPlaying: songinfostate === "playing",
          isLiked: songinfocurrentsongliked,
          volume: songinfovolume,
          repeat: songinforepeat,
          progress: songinfocurrentdur,
          duration: songinfoenddur,
          id: songinfocurrentsongurl
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
        if (window.requestPlusSoundCloudInterval) {
          clearInterval(window.requestPlusSoundCloudInterval);
        }
        window.requestPlusSoundCloudInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            sendCurrentTrack(ws);
          }
        }, 1000);
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
          const normalizedCommand = typeof command === "string" ? command.toLowerCase() : "";
          
          if (welcome) {
            ws.send(JSON.stringify({ 
              command: "identify", 
              type: "soundcloud", 
              version: "2.0.1" 
            }));
            console.log("RequestPlus|Identified to server");
            return; // Don't process as a command
          }

          // Only log and process actual commands
          console.log("RequestPlus|Received command:", command);

          switch (normalizedCommand) {
            case "playpause":
            case "play_pause":
            case "toggleplay":
              clickSelector(".playControls__elements .playControl, .playControl");
              await delay(10);
              sendCurrentTrack(ws);
              break;

            case "next":
              clickSelector(".playControls__elements .skipControl__next, .skipControl__next");
              await delay(100);
              sendCurrentTrack(ws);
              break;

            case "prev":
            case "previous":
              clickSelector(".playControls__elements .skipControl__previous, .skipControl__previous");
              await delay(100);
              sendCurrentTrack(ws);
              break;

            case "getdata":
            case "getinfo":
              sendCurrentTrack(ws);
              break;

            case "like":
              clickSelector(".playbackSoundBadge__actions .playbackSoundBadge__like");
              await delay(50);
              sendCurrentTrack(ws);
              break;

            case "volume":
              if (messageData.data && typeof messageData.data.volume === "number") {
                var newVolume = messageData.data.volume;
                console.log("RequestPlus|Setting volume to:", newVolume);
                if (await setVolume(newVolume)) {
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

            case "seek":
              if (messageData.data && typeof messageData.data.position === "number") {
                if (!seekTo(messageData.data.position)) {
                  ws.send(JSON.stringify({ command: "error", data: "Failed to seek. Start playback first." }));
                }
                await delay(50);
                sendCurrentTrack(ws);
              }
              break;

            case "addtrack":
              if (messageData.data?.url || messageData.data?.uri) {
                const added = await addTrack(messageData.data.url || messageData.data.uri);
                if (!added) {
                  ws.send(JSON.stringify({ command: "error", data: "Failed to add SoundCloud track to Next up." }));
                }
                await delay(500);
                sendCurrentTrack(ws);
              } else {
                ws.send(JSON.stringify({ command: "error", data: "Missing SoundCloud track URL." }));
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
        if (window.requestPlusSoundCloudInterval) {
          clearInterval(window.requestPlusSoundCloudInterval);
          window.requestPlusSoundCloudInterval = null;
        }
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

  console.log("RequestPlus|Integration loaded and initialized v2.1");
})();
