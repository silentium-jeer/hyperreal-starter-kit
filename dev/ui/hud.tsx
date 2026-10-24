import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimGraphLabHud } from './hud/AnimGraphLabHud';
import { MainSceneHud } from './hud/MainSceneHud';
import './styles.css';

// Each scene's panels show while that scene reports its state (useGameState).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MainSceneHud />
    <AnimGraphLabHud />
  </StrictMode>,
);
