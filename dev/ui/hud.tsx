import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimGraphLabHud } from './hud/AnimGraphLabHud';
import { FlightCaseLabHud } from './hud/FlightCaseLabHud';
import { InstancingLabHud } from './hud/InstancingLabHud';
import { LumenLabHud } from './hud/LumenLabHud';
import { MainSceneHud } from './hud/MainSceneHud';
import { MannequinLabHud } from './hud/MannequinLabHud';
import { MaterialsLabHud } from './hud/MaterialsLabHud';
import { NaniteLabHud } from './hud/NaniteLabHud';
import { PhysicsLabHud } from './hud/PhysicsLabHud';
import { PlaygroundLabHud } from './hud/PlaygroundLabHud';
import { SpinningCubesLabHud } from './hud/SpinningCubesLabHud';
import './styles.css';

// Each scene's panels show while that scene reports its state (useGameState).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MainSceneHud />
    <AnimGraphLabHud />
    <MannequinLabHud />
    <PlaygroundLabHud />
    <FlightCaseLabHud />
    <NaniteLabHud />
    <SpinningCubesLabHud />
    <InstancingLabHud />
    <LumenLabHud />
    <PhysicsLabHud />
    <MaterialsLabHud />
  </StrictMode>,
);
