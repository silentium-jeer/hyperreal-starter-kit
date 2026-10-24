import { createRoot } from 'react-dom/client'

import './shell.css'
import { listenForFab } from './fab'
import { WindowChrome } from './WindowChrome'

// The shell window's title bar, a root of its own above the app (main.tsx, the web-starter-kit's, unchanged).
createRoot(document.getElementById('window-chrome')!).render(<WindowChrome />)
listenForFab()
