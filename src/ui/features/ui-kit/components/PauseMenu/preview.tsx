import { useState } from 'react'

import { AudioSettingsControls } from '../AudioSettingsControls/AudioSettingsControls'
import { ControlButton } from '../ControlButton/ControlButton'
import { PauseMenu } from './PauseMenu'
import type { AudioSettingsValues } from '../AudioSettingsControls/AudioSettingsControls'
import type { PauseMenuEntry } from './PauseMenu'
import type { UiKitPreview } from '../../systems/uiKitPreview'

const ENTRIES: readonly PauseMenuEntry[] = [
  { id: 'settings', label: 'Sound settings' },
  { id: 'restart', label: 'Restart level' },
]

const STAGE = {
  position: 'relative',
  overflow: 'hidden',
  width: 460,
  height: 340,
  borderRadius: 10,
  background: 'repeating-linear-gradient(45deg, #16242f 0 14px, #101b24 14px 28px)',
  contain: 'paint',
} as const

function Stage({ children, label }: { readonly children: React.ReactNode; readonly label: string }) {
  return (
    <div style={STAGE}>
      <div style={{ position: 'relative', zIndex: 41, padding: 12, color: '#cfe6f5', font: "800 11px/1 'Trebuchet MS', sans-serif", letterSpacing: '0.1em' }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function PauseMenuPreview() {
  const [view, setView] = useState<string | null>(null)
  const [values, setValues] = useState<AudioSettingsValues>({ master: 0.9, music: 0.55, muted: false, sfx: 1 })

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
      <Stage label="LIVE — CLICK THROUGH IT">
        <PauseMenu
          activeEntryId={view}
          data-testid="preview-pause-menu"
          entries={ENTRIES}
          hint="Escape closes this menu"
          onBack={() => setView(null)}
          onResume={() => setView(null)}
          onSelect={(id) => setView(id === 'restart' ? null : id)}
        >
          <AudioSettingsControls
            onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
            values={values}
          />
        </PauseMenu>
      </Stage>
      <Stage label="THE SETTINGS SCREEN, PINNED OPEN">
        <PauseMenu
          activeEntryId="settings"
          entries={ENTRIES}
          onBack={() => {}}
          onResume={() => {}}
          onSelect={() => {}}
        >
          <AudioSettingsControls onChange={() => {}} values={values} />
        </PauseMenu>
      </Stage>
      <div style={{ flexBasis: '100%', padding: 10, borderRadius: 10, background: '#101b24' }}>
        <ControlButton onClick={() => setView(null)}>Reset the live one</ControlButton>
      </div>
    </div>
  )
}

export const uiKitPreview: UiKitPreview = {
  description: 'Game menu over a stand-in game: the entry list, and the sound screen one entry opens.',
  id: 'pause-menu',
  render: () => <PauseMenuPreview />,
  title: 'Pause menu',
}

