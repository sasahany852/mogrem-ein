"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsWatcher = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
class SettingsWatcher {
    constructor(client) {
        this.client = client;
        this.settingsPath = (0, path_1.join)(process.cwd(), 'settings.json');
        this.lastContent = (0, fs_1.readFileSync)(this.settingsPath, 'utf8');
        this.updateSettings(this.lastContent);
    }
    updateSettings(content) {
        try {
            const newSettings = JSON.parse(content);
            this.client.settings = newSettings;
            if (newSettings.defaultLanguage !== this.client.defaultLanguage) {
                this.client.defaultLanguage = newSettings.defaultLanguage;
            }
            this.client.aliases.clear();
            for (const [commandName, command] of this.client.commands) {
                if (newSettings.commands?.[commandName]?.aliases) {
                    newSettings.commands[commandName].aliases.forEach((alias) => {
                        this.client.aliases.set(alias, commandName);
                    });
                }
                if (command.command) {
                    command.command.enabled = newSettings.commands?.[commandName]?.enabled ?? true;
                }
            }
            delete require.cache[require.resolve('../../settings.json')];
            console.log('Settings reloaded successfully');
        }
        catch (error) {
            console.error('Error updating settings:', error);
        }
    }
    start() {
        (0, fs_1.watchFile)(this.settingsPath, { interval: 1000 }, () => {
            try {
                const currentContent = (0, fs_1.readFileSync)(this.settingsPath, 'utf8');
                if (currentContent !== this.lastContent) {
                    this.updateSettings(currentContent);
                    this.lastContent = currentContent;
                }
            }
            catch (error) {
                console.error('Error in settings watcher:', error);
            }
        });
    }
    stop() {
        try {
            const { unwatchFile } = require('fs');
            unwatchFile(this.settingsPath);
        }
        catch (error) {
            console.error('Error stopping settings watcher:', error);
        }
    }
}
exports.SettingsWatcher = SettingsWatcher;
