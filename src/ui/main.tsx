import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { BootstrapGate } from './features/bootstrap'
import { trimUserTimingInDev } from './shared/lib/dev/trimUserTiming'
import { initAudioSettings } from './shared/lib/audio/audioSettings'

trimUserTimingInDev()

const blockedNativeInteractionEvents = ['contextmenu', 'selectstart', 'dragstart'] as const

blockedNativeInteractionEvents.forEach((eventName) => {
  document.addEventListener(
    eventName,
    (event) => {
      event.preventDefault()
    },
    true,
  )
})

initAudioSettings()

createRoot(document.getElementById('root')!).render(
  <BootstrapGate labels={{ progress: 'Loading', retry: 'Retry' }}>
    <App />
  </BootstrapGate>,
)
