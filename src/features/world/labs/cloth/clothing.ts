import * as UE from 'ue';

export const CLOTH_ASSET = 'Cloth_Cloth';

export const FABRICS = {
  silk: { edge: 0.6, bending: 0.01, area: 0.6 },
  cotton: { edge: 1, bending: 0.1, area: 1 },
  canvas: { edge: 1, bending: 0.8, area: 1 },
} as const;

export type Fabric = keyof typeof FABRICS;

export function clothOn(component: UE.SkeletalMeshComponent | undefined) {
  const simulation = component?.GetClothingSimulationInteractor();
  const cloth = simulation?.GetClothingInteractor(CLOTH_ASSET) as UE.ChaosClothingInteractor | undefined;
  return simulation && cloth ? { simulation, cloth } : undefined;
}

export function blowWind(component: UE.SkeletalMeshComponent | undefined, velocity: UE.Vector) {
  const cloth = clothOn(component)?.cloth;
  cloth?.SetWind(new UE.Vector2D(0.1, 0.1), new UE.Vector2D(0.08, 0.08), 1.225e-6, velocity);
}

export function weave(component: UE.SkeletalMeshComponent | undefined, fabric: Fabric) {
  const { edge, bending, area } = FABRICS[fabric];
  clothOn(component)?.cloth.SetMaterialLinear(edge, bending, area);
}

export function clothStats(component: UE.SkeletalMeshComponent | undefined) {
  const simulation = clothOn(component)?.simulation;
  if (!simulation) return undefined;
  return { cloths: simulation.GetNumCloths(), dynamic: simulation.GetNumDynamicParticles(), kinematic: simulation.GetNumKinematicParticles(), iterations: simulation.GetNumIterations(), simulationMs: simulation.GetSimulationTime() };
}
