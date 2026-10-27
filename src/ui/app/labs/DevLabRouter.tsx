import { Suspense, lazy, useMemo } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { LabsScreen } from '../ui/labs/LabsScreen'
import { DEV_LABS } from './labRegistry'

export default function DevLabRouter() {
  const screens = useMemo(
    () => DEV_LABS.map((lab) => ({ Screen: lazy(lab.load), id: lab.id })),
    [],
  )

  return (
    <Suspense fallback={null}>
      <Routes>
        <Route index element={<LabsScreen />} />
        {screens.map(({ Screen, id }) => (
          <Route element={<Screen />} key={id} path={id} />
        ))}
        <Route element={<Navigate replace to="/labs" />} path="*" />
      </Routes>
    </Suspense>
  )
}
