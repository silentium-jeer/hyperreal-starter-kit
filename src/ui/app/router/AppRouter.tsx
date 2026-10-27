import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { GameScreen } from '../../features/world'

const DevLabRouter = __SHOWCASE_SURFACES__ ? lazy(async () => import('../labs/DevLabRouter')) : null

const UiKitGallery = __SHOWCASE_SURFACES__
  ? lazy(async () => {
    const module = await import('../../features/ui-kit')
    return { default: module.UiKitGallery }
  })
  : null

const PAGES_REDIRECT_KEY = 'web-starter-kit:pages-redirect'
const configuredBaseName = import.meta.env.BASE_URL.replace(/\/$/, '')
const APP_BASE_NAME = configuredBaseName && configuredBaseName !== '.' ? configuredBaseName : undefined

function restoreGitHubPagesRoute() {
  const redirect = window.sessionStorage.getItem(PAGES_REDIRECT_KEY)
  if (!redirect || !APP_BASE_NAME || !redirect.startsWith(`${APP_BASE_NAME}/`)) return

  window.sessionStorage.removeItem(PAGES_REDIRECT_KEY)
  window.history.replaceState(null, '', redirect)
}

export function AppRouter() {
  restoreGitHubPagesRoute()

  return (
    <BrowserRouter basename={APP_BASE_NAME}>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<GameScreen />} />

          {UiKitGallery ? <Route path="/ui-kit/*" element={<UiKitGallery />} /> : null}

          {DevLabRouter ? <Route path="/labs/*" element={<DevLabRouter />} /> : null}

          {DevLabRouter ? (
            <Route path="/character-debug" element={<Navigate replace to="/labs/character-debug-lab" />} />
          ) : null}

          <Route path="*" element={<Navigate replace to="/" />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
