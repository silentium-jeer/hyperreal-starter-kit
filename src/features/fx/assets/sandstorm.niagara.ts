import { defineSystem } from '../../../shared/niagara';

const GAS_SMOKE = '/NiagaraFluids/Templates/Gas/3D/Systems/Grid3D_Gas_Smoke.Grid3D_Gas_Smoke';

export const sandstorm = defineSystem({
  template: GAS_SMOKE,
  emitters: {
    Grid3D_Gas_Master_Emitter: {
      constants: {
        'User.WorldSpaceSize': [3600, 1800, 900],
        'User.ResolutionMaxAxis': 192,
        'User.Emit Position': [-1400, 0, 260],
        'Grid3D_Gas_QualityOverrides.Override.Resolution Max Axis': true,
        'Grid3D_Gas_SphereSource.Temperature': 0,
        'Grid3D_Gas_SphereSource.Density': 3,
        'Grid3D_Gas_SphereSource.Emit Radius': 240,
        'Grid3D_Gas_SphereSource.Non Uniform Scale': [0.8, 3.4, 2.2],
        'Grid3D_Gas_SphereSource.Velocity': [700, 0, 200],
        'Grid3D_Gas_SphereSource.Noise Intensity 1': 0.6,
        'Grid3D_Gas_SphereSource.Noise Frequency 1': 2,
        'Grid3D_Gas_SphereSource.Noise Speed 1': 1.4,
        'Grid3D_Gas_SphereSource.Noise Intensity 2': 0.35,
        'Grid3D_Gas_SphereSource.Noise Frequency 2': 6,
        'Grid3D_Gas_SphereSource.Noise Speed 2': 2.6,
        'Grid3D_Gas_Buoyancy.TemperatureBuoyancy': 0,
        'Grid3D_Gas_Buoyancy.DensityBuoyancy': 0.1,
        'Grid3D_Advect_FluidAttribute.Dissipation Rate Density': 0.15,
        'Grid3D_Gas_MaterialControls.Smoke Color': [0.55, 0.36, 0.18, 1],
        'Grid3D_Gas_MaterialControls.Density Gain': 2,
      },
    },
  },
});
