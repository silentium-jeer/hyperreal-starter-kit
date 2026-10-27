import * as UE from 'ue';

const settings = () => UE.GameUserSettings.GetGameUserSettings();

export const DEFAULT_FRAME_RATE_LIMIT = 60;

export function setFrameRateLimit(framesPerSecond: number) {
  settings().SetFrameRateLimit(Math.max(0, framesPerSecond));
  settings().ApplyNonResolutionSettings();
}

export const frameRateLimit = () => settings().GetFrameRateLimit();

export function setVSync(on: boolean) {
  settings().SetVSyncEnabled(on);
  settings().ApplyNonResolutionSettings();
}

export const vsync = () => settings().IsVSyncEnabled();
