import { createRoot } from 'react-dom/client'

import './shell.css'
import { listenForFab } from './fab'
import { FabNotices } from './FabNotices'
import { listenForOpen } from './open'
import { WindowChrome } from './WindowChrome'

createRoot(document.getElementById('window-chrome')!).render(<WindowChrome />)
const notices = document.body.appendChild(document.createElement('div'))
notices.id = 'fab-notices'
createRoot(notices).render(<FabNotices />)
listenForFab()
listenForOpen()
