const tmi = require('tmi.js');
const wait = require('node:timers/promises').setTimeout;

class ChatHandler {
    constructor(mainWindow, logger, twitchAuth, WSServer) {
        this.mainWindow = mainWindow;
        this.logger = logger;
        this.WSServer = WSServer;

        this.Client = new tmi.client({
            options: { debug: true },
            connection: {
                reconnect: true,
                secure: true
            },
            identity: {
                username: twitchAuth.login,
                password: twitchAuth.access_token
            },
            channels: [twitchAuth.login]
        });
        this.Client.on('message', async (channel, tags, message, self) => {
            console.log(message)
            if (message.toLowerCase().startsWith('!sr')) {
                var requesta = message.split(' ').splice(1).join(' ')
                console.log(requesta)
                if (requesta.includes("https://open.spotify.com/")){
                    if (requesta.includes("https://open.spotify.com/album")) {
                        this.Client.say(channel, `Request+: Please provide a spotify track link!`)
                        return
                    }
                    if (requesta.includes("https://open.spotify.com/playlist")) {
                        this.Client.say(channel, `Request+: Please provide a spotify track link!`)
                        return
                    }
                    if (requesta.includes("https://open.spotify.com/episode")) {
                        this.Client.say(channel, `Request+: Please provide a spotify track link!`)
                        return
                    }

                    var ida = requesta.split("https://open.spotify.com/track/")[1]
                    let id;
                    if (ida.includes("?si=")) {
                        id = ida.split("?si=")[0]
                    } else {
                        id = ida
                    }
                    this.WSServer.WSSend({'command':'addTrack', 'data': { 'uri': `spotify:track:${id}`}})
                    await wait(2000)
                    if (this.WSServer.lastReq){
                        var dataArtists = []
                        var response = this.WSServer.lastReq
                        console.log(response.name)
                        console.log(response.artists != null)
                        if (response.artists != null) {
                            for (var artist in response.artists) {
                                dataArtists.push(response.artists[artist].name)
                            } 
                        }
                       
                        var artists = dataArtists.join(", ");
                        var title = response.name;
                        this.Client.say(channel, `Request+: Song ${title} by ${artists} has been queued.`)
                    } else {
                        this.Client.say(channel, "Request+: the song was sent to queue, but didn't return any song information. Song maybe is queued. ERR: RPLUS_SONG_KINDA_QUEUED")
                    }
                } else {
                    this.Client.say(channel, `Request+: Please provide a spotify track link! Usage: !sr <link>`)
                }
               
            }
        });
    }
    async connect() {
        this.Client.connect();
    }


    
}

module.exports = ChatHandler;