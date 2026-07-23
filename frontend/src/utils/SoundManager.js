import { Audio } from 'expo-av';

class SoundManager {
    constructor() {
        this.sounds = {};
        this.music = null;
        this.isMuted = false;
        
        // Define audio map
        this.audioMap = {
            tick: require('../../assets/sounds/ticking_clock.wav'),
            rejection: require('../../assets/sounds/rejection.mp3'),
            stamp: require('../../assets/sounds/thump.mp3'),
            fanfare: require('../../assets/sounds/fanfare-g.flac'),
            woosh: require('../../assets/sounds/quick-woosh.mp3'),
            correct: require('../../assets/sounds/correct.mp3'),
            tally: require('../../assets/sounds/score-count.wav'),
        };
    }

    async init() {
        try {
            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
            });
            
            // Pre-load sound effects
            for (const [key, resource] of Object.entries(this.audioMap)) {
                const { sound } = await Audio.Sound.createAsync(resource);
                this.sounds[key] = sound;
            }
        } catch (e) {
            console.warn('Failed to init SoundManager:', e);
        }
    }

    async playSfx(name) {
        if (this.isMuted || !this.sounds[name]) return;
        try {
            // Stop and replay immediately if called repeatedly
            await this.sounds[name].setIsLoopingAsync(false);
            await this.sounds[name].replayAsync();
        } catch (e) {
            console.warn(`Failed to play sfx ${name}:`, e);
        }
    }

    async startLoop(name) {
        if (this.isMuted || !this.sounds[name]) return;
        try {
            const status = await this.sounds[name].getStatusAsync();
            if (status.isPlaying && status.isLooping) return; // already looping

            await this.sounds[name].setIsLoopingAsync(true);
            await this.sounds[name].replayAsync();
        } catch (e) {
            console.warn(`Failed to start loop ${name}:`, e);
        }
    }

    async stopLoop(name) {
        if (!this.sounds[name]) return;
        try {
            await this.sounds[name].stopAsync();
            await this.sounds[name].setIsLoopingAsync(false);
        } catch (e) {
            console.warn(`Failed to stop loop ${name}:`, e);
        }
    }
}

export default new SoundManager();
