const tmi = require('tmi.js');


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
        this.Client.on('message', (channel, tags, message, self) => {
            console.log(message)
            if (message.toLowerCase().startsWith('!sr ')) {

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
                    this.Client.say(channel, `Request+: Song now queued.`)
                }
               
            }
        });
    }
    async connect() {
        this.Client.connect();
    }


    
}

module.exports = ChatHandler;