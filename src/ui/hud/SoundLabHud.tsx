import { post } from '../bridge'
import { ControlButton, ControlPanel } from '../features/ui-kit'
import styles from './LabHud.module.css'
import { useGameState } from './useGameState'

type SoundState = { ready: Record<string, boolean>; effects: string[]; ticking: boolean; music: boolean; played: number }

export function SoundLabHud() {
  const state = useGameState<SoundState>('sound/state')
  if (!state) return null
  return (
    <div className={styles.corner} data-hit data-testid="sound-hud">
      <ControlPanel maxWidth={340} title="Sound">
        <p className={styles.about}>Sound files imported like models. The cube ticks in 3D as it circles; effects play in 2D.</p>
        {state.effects.map((effect) => (
          <ControlButton data-testid={`sound-effect-${effect}`} disabled={!state.ready[effect]} key={effect} onClick={() => post({ type: 'sound/effect', effect })}>
            {effect}
          </ControlButton>
        ))}
        <ControlButton active={state.ticking} data-testid="sound-ticking" disabled={!state.ready.tick} onClick={() => post({ type: 'sound/ticking', value: !state.ticking })}>
          Speaker ticks
        </ControlButton>
        <ControlButton active={state.music} data-testid="sound-music" disabled={!state.ready.pad} onClick={() => post({ type: 'sound/music', value: !state.music })}>
          Music
        </ControlButton>
        <p className={styles.about} data-testid="sound-played">Played: {state.played}</p>
      </ControlPanel>
    </div>
  )
}
