import { post } from '../bridge'
import { ControlButton, ControlPanel } from '../features/ui-kit'
import styles from './LabHud.module.css'
import { Readout } from './Readout'
import { useGameState } from './useGameState'

type RagdollState = { drops: number; bodies: number; dropped?: boolean; minHeadToHips?: number; restHeadToHips?: number; lastSpeed?: number }

export function RagdollLabHud() {
  const state = useGameState<RagdollState>('ragdoll/state')
  if (!state) return null
  return (
    <div className={styles.corner} data-hit data-testid="ragdoll-hud">
      <ControlPanel maxWidth={320} title="Ragdoll">
        <p className={styles.about}>The physics asset the import built: {state.bodies} bodies with anatomical limits and masses.</p>
        <ControlButton data-testid="ragdoll-drop" onClick={() => post({ type: 'ragdoll/drop' })} variant="accent">
          Drop
        </ControlButton>
        {state.minHeadToHips !== undefined && (
          <Readout
            rows={[
              ['Head to hips, standing', `${state.restHeadToHips} cm`],
              ['Head to hips, closest', `${state.minHeadToHips} cm`],
              ['Speed now', `${state.lastSpeed} cm/s`],
            ]}
          />
        )}
      </ControlPanel>
    </div>
  )
}
