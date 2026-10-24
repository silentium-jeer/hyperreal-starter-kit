import { createRoot } from 'react-dom/client'

import './shell.css'
import { listenForFab } from './fab'
import { FabNotices } from './FabNotices'
import { WindowChrome } from './WindowChrome'

// The shell window's title bar, a root of its own above the app (main.tsx, the web-starter-kit's, unchanged).
createRoot(document.getElementById('window-chrome')!).render(<WindowChrome />)
// The notices of assets added from the Fab window, a root of their own over every screen.
const notices = document.body.appendChild(document.createElement('div'))
notices.id = 'fab-notices'
createRoot(notices).render(<FabNotices />)
listenForFab()
