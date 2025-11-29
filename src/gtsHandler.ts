/**
 * @file gtsHandler.ts
 * @copyright 2025 Quil DayTrack 
 * 
 * @license GPL-v3.0
 * @version 1.2.1
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
    public hasGuessed: boolean = false;
    constructor( app: App, mainWindow: BrowserWindow, APIHandler: APIHandler, playbackHandler: PlaybackHandler, logger: Logger, settings: Settings) {
        this.app = app;
        this.mainWindow = mainWindow;
        this.playbackHandler = playbackHandler;
        this.apiHandler = APIHandler;
        this.logger = logger;
        this.settings = settings;
        this.refresh = null;
        if (this.settings.gtsEnabled) {
            this.gtsActive = true;
        } else {
            this.gtsActive = false;
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

}

