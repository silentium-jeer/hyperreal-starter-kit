import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MainSceneHud } from './hud/MainSceneHud';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MainSceneHud />
  </StrictMode>,
);
