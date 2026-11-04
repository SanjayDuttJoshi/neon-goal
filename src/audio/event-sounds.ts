import { GameEventKind, type GameEvent } from "@/types/game";
import { SoundKind } from "@/types/audio";
import { vibrate, type SoundEngine } from "@/audio/sound-engine";

/** Plays the matching sound (and a buzz on phones) for each game event. */
export const playEventSounds = (sound: SoundEngine, events: GameEvent[], selfId: string | null): void => {
  for (const event of events) {
    const mine = selfId !== null && event.playerId === selfId;
    switch (event.kind) {
      case GameEventKind.TrailBounce:
        sound.play(SoundKind.Bounce, event.value / 700);
        break;
      case GameEventKind.PowerBounce:
        sound.play(SoundKind.Power);
        if (mine) vibrate(40);
        break;
      case GameEventKind.WallHit:
        sound.play(SoundKind.Wall, Math.min(1.2, event.value / 600));
        break;
      case GameEventKind.BodyHit:
        sound.play(SoundKind.Body);
        break;
      case GameEventKind.Dash:
        if (mine) sound.play(SoundKind.Dash);
        break;
      case GameEventKind.Slowed:
        if (mine) {
          sound.play(SoundKind.Slowed);
          vibrate(30);
        }
        break;
      case GameEventKind.Save:
        sound.play(SoundKind.Save);
        break;
      case GameEventKind.Goal:
        sound.play(SoundKind.Goal);
        vibrate([80, 40, 160]);
        break;
      case GameEventKind.MatchEnd:
        sound.play(SoundKind.Whistle);
        break;
      default:
        break;
    }
  }
};
