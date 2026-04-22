import TrackPlayer, { Event } from 'react-native-track-player';

const playbackService = async () => {
  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    await TrackPlayer.play();
  });

  TrackPlayer.addEventListener(Event.RemotePause, async () => {
    await TrackPlayer.pause();
  });

  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    await TrackPlayer.stop();
  });

  TrackPlayer.addEventListener(Event.RemoteSeek, async (event) => {
    if ('position' in event) {
      await TrackPlayer.seekTo(event.position);
    }
  });

  TrackPlayer.addEventListener(Event.RemoteJumpForward, async (event) => {
    const current = await TrackPlayer.getPosition();
    const interval = 'interval' in event ? event.interval ?? 30 : 30;
    await TrackPlayer.seekTo(current + interval);
  });

  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async (event) => {
    const current = await TrackPlayer.getPosition();
    const interval = 'interval' in event ? event.interval ?? 15 : 15;
    await TrackPlayer.seekTo(Math.max(0, current - interval));
  });
};

export default playbackService;

