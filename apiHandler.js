const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');



class APIHandler {
    constructor(mainWindow, WSServer, logger, settings) {
        this.app = app;
        this.mainWindow = mainWindow;
        this.WSServer = WSServer;
        this.logger = logger;
        this.theme = settings.theme


        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({ extended: true }));
        this.app.use(cors({
            origin: '*', // In production, replace with specific origin
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization']
        }));

        this.app.get("/info", (req, res) => {
            res.json(this.WSServer.lastInfo)
        })
        this.app.get("/settings", (req, res) => {
            res.json({theme: this.theme})
        })
        this.app.listen(444, () => {
            this.logger.info('API server listening on port 444');
        })

    }
}

module.exports = APIHandler;