import { useEffect, useRef } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Asset } from 'expo-asset';

const TRACK_MODULES = [
  require('../../music/Th01.mp3'),
  require('../../music/Th02.mp3'),
  require('../../music/Th03.mp3'),
  require('../../music/Th04.mp3'),
  require('../../music/Th05.mp3'),
  require('../../music/Th06.mp3'),
  require('../../music/Th07.mp3'),
  require('../../music/Th08.mp3'),
  require('../../music/Th09.mp3'),
  require('../../music/Th10.mp3'),
];

// Pre-download all tracks at module load so the first tap plays immediately
Asset.loadAsync(TRACK_MODULES).catch(() => {});

export function useMusic(on: boolean) {
  const soundRef  = useRef<Audio.Sound | null>(null);
  const trackIdx  = useRef(Math.floor(Math.random() * TRACK_MODULES.length));
  const activeRef = useRef(on);
  useEffect(() => { activeRef.current = on; }, [on]);

  useEffect(() => {
    if (!on) {
      const s = soundRef.current;
      soundRef.current = null;
      s?.stopAsync().then(() => s.unloadAsync()).catch(() => {});
      return;
    }

    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
    }).catch(() => {});

    let cancelled = false;

    const playNext = async (): Promise<void> => {
      if (cancelled || !activeRef.current) return;

      let sound: Audio.Sound | null = null;
      try {
        const { sound: s } = await Audio.Sound.createAsync(
          TRACK_MODULES[trackIdx.current],
          { shouldPlay: true, volume: 1.0 },
        );
        sound = s;

        if (cancelled || !activeRef.current) {
          await sound.unloadAsync();
          return;
        }

        soundRef.current = sound;

        // Wait for the track to finish naturally (or be stopped externally)
        await new Promise<void>((resolve) => {
          sound!.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
            if (!status.isLoaded)                         resolve();
            else if (status.didJustFinish)                resolve();
          });
        });

        if (soundRef.current === sound) soundRef.current = null;
        await sound.unloadAsync().catch(() => {});

        if (cancelled || !activeRef.current) return;

        trackIdx.current = (trackIdx.current + 1) % TRACK_MODULES.length;
        return playNext();

      } catch (err) {
        console.warn('[useMusic]', err);
        if (sound) { sound.unloadAsync().catch(() => {}); }
        if (soundRef.current === sound) soundRef.current = null;
      }
    };

    playNext();

    return () => {
      cancelled = true;
      const s = soundRef.current;
      soundRef.current = null;
      s?.stopAsync().then(() => s.unloadAsync()).catch(() => {});
    };
  }, [on]);
}
