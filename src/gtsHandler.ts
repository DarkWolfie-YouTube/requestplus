/**
 * @file gtsHandler.ts
 * @copyright 2025 Quil DayTrack 
 * 
 * @license GPL-v3.0
 * @version 2.0.1
 *
 * @description
 * A Guess the Song Extension Handler, allowes chat to guess the next song before displaying it after 30 seconds!
 */

import apiHandler from "./apiHandler";
import { App } from "electron";
import { Settings } from "./settingsHandler";
import { BrowserWindow } from "electron";
import PlaybackHandler, {songInfo} from "./playbackHandler";
import Logger from "./logger";
import APIHandler from './apiHandler';


export default class GTSHandler {
    private app: App;
    private mainWindow: BrowserWindow;
    private apiHandler: apiHandler;
    private playbackHandler: PlaybackHandler;
    private logger: Logger;
    private settings: Settings;
    private refresh: boolean;
    private callback: any;
    private gtsActive: boolean;
    private songInfo: songInfo;
    private scoresFilePath: string;
    private scores: Record<string, number> = {};
    private attemptedUsers: Set<string> = new Set();
    public hasGuessed: boolean = false;
    constructor( app: App, mainWindow: BrowserWindow, APIHandler: APIHandler, playbackHandler: PlaybackHandler, logger: Logger, settings: Settings) {
        this.app = app;
        this.mainWindow = mainWindow;
        this.playbackHandler = playbackHandler;
        this.apiHandler = APIHandler;
        this.logger = logger;
        this.settings = settings;
        this.refresh = null;
        this.scoresFilePath = require('node:path').join(this.app.getPath('userData'), 'gts_scores.json');
        this.loadScores();
        if (this.settings.gtsEnabled) {
            this.gtsActive = true;
        } else {
            this.gtsActive = false;
        }
    }

    private loadScores(): void {
        try {
            const fs = require('node:fs');
            if (fs.existsSync(this.scoresFilePath)) {
                this.scores = JSON.parse(fs.readFileSync(this.scoresFilePath, 'utf-8'));
            }
        } catch (error) {
            this.logger.warn('GTS: Failed to load scores', error);
            this.scores = {};
        }
    }

    private saveScores(): void {
        try {
            const fs = require('node:fs');
            fs.writeFileSync(this.scoresFilePath, JSON.stringify(this.scores, null, 2), 'utf-8');
        } catch (error) {
            this.logger.warn('GTS: Failed to save scores', error);
        }
    }

    private hideSongFromView(): void {
        this.apiHandler.gtsHideSongFromView();
    }

    public async callForHide(): Promise<string> {
        console.log(`GTS Check: GTS Active: ${this.gtsActive}`);

        if (this.gtsActive) {
            if (this.apiHandler.hideSongFromView == true) return "alreadyHidden";
            this.songInfo = await this.playbackHandler.getCurrentSong();
            console.log(`GTS Check: Retrieved Song Info: ${JSON.stringify(this.songInfo)}`);
            if (this.songInfo) {
                //make it prepare for next song 10 seconds before the song ends
                console.log(`GTS Check: Song Duration: ${this.songInfo.duration}, Song Progress: ${this.songInfo.progress}`);
                console.log(`GTS Check: Time Left: ${this.songInfo.duration - this.songInfo.progress}`);
                console.log(`GTS Check: GTS Active: ${this.gtsActive}`);
                if (this.songInfo.duration - this.songInfo.progress <= 10000) {
                    this.hideSongFromView();
                    return "hiddenSong";
                } else {
                    return "waitingToHide";
                }
            } else {
                return "noSongInfo";
            }
        }
    }


    public updateSettings(settings: Settings): void {
        this.settings = settings;
        if (this.settings.theme.includes("nowplaying")) {
            this.gtsActive = false;
            return;
        }
        if (this.settings.gtsEnabled) {
            this.gtsActive = true;
        } else {
            this.gtsActive = false;
        }
    }

    public failedToGuess(): void {
        if (this.gtsActive) {
            this.logger.info("GTS: User failed to guess the song in time.");
            this.hasGuessed = false;
            this.attemptedUsers.clear();
            this.apiHandler.gtsShowSongInView();
            
        }
    }

    public async gtshandle(guess: string): Promise<boolean> {
        this.songInfo = await this.playbackHandler.getCurrentSong();
        if (!this.songInfo) return false;
        const actualTitle = this.songInfo.title.toLowerCase().trim();
        const userGuess = guess.toLowerCase().trim();
        console.log(`GTS Check: Actual Title: ${actualTitle}, User Guess: ${userGuess}`);
        if (actualTitle === userGuess) {
            this.apiHandler.gtsShowSongInView();
            this.hasGuessed = true;
            return true;
        } else {
            return false;
        }
    }

    public async handleChatGuess(username: string, guess: string): Promise<{ code: string; points?: number }> {
        if (!this.settings.gtsEnabled || this.gtsActive === false) {
            return { code: 'ERR_GTS_DISABLED' };
        }

        const key = username.toLowerCase();
        if (this.attemptedUsers.has(key)) {
            return { code: 'ERR_GTS_ALREADY_GUESSED', points: this.scores[key] || 0 };
        }

        this.attemptedUsers.add(key);
        const correct = await this.gtshandle(guess);
        if (!correct) {
            return { code: 'ERR_GTS_WRONG', points: this.scores[key] || 0 };
        }

        this.scores[key] = (this.scores[key] || 0) + 1;
        this.saveScores();
        return { code: 'OKAY_GTS_CORRECT', points: this.scores[key] };
    }

}

