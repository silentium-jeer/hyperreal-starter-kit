import * as UE from 'ue';
import { useEffect, useRef, type MutableRefObject } from 'react';
import { loadContent, onNiagara, type ContentNiagara } from '../engine/content';
import type { NiagaraSystemRef, NiagaraUserValue } from '../niagara';
import type { Vector3 } from './props';

export interface NiagaraSystemProps {
  system: NiagaraSystemRef;
  at: Vector3;
  rotation?: Vector3;
  params?: Record<string, NiagaraUserValue>;
  actorRef?: MutableRefObject<UE.NiagaraActor | null>;
}

function setParams(component: UE.NiagaraComponent, types: ContentNiagara['user'], params: Record<string, NiagaraUserValue>, key: string) {
  for (const [name, value] of Object.entries(params)) {
    const type = types[name];
    if (type === 'float' && typeof value === 'number') component.SetVariableFloat(name, value);
    else if (type === 'bool' && typeof value === 'boolean') component.SetVariableBool(name, value);
    else if (type === 'vector' && Array.isArray(value)) component.SetVariableVec3(name, new UE.Vector(value[0], value[1], value[2]));
    else if (type === 'color' && Array.isArray(value)) component.SetVariableLinearColor(name, new UE.LinearColor(value[0], value[1], value[2], value[3] ?? 1));
    else console.error(`[niagara] ${key}: '${name}' is ${type ? `a ${type} user parameter, given ${JSON.stringify(value)}` : `not a user parameter (parameters: ${Object.keys(types).join(', ') || 'none'})`}`);
  }
}

export function NiagaraSystem({ system, at, rotation, params, actorRef }: NiagaraSystemProps) {
  const own = useRef<UE.NiagaraActor | null>(null);
  const actor = actorRef ?? own;
  const current = useRef<ContentNiagara | undefined>(undefined);
  const latestParams = useRef(params);
  latestParams.current = params;

  useEffect(
    () =>
      onNiagara(system, (built) => {
        const component = actor.current?.NiagaraComponent;
        const asset = loadContent<UE.NiagaraSystem>(built.path);
        if (!component || !asset) return;
        current.current = built;
        component.SetAsset(asset, true);
        if (latestParams.current) setParams(component, built.user, latestParams.current, system.key);
        component.Activate(true);
      }),
    [system.key],
  );

  useEffect(() => {
    const component = actor.current?.NiagaraComponent;
    if (component && current.current && params) setParams(component, current.current.user, params, system.key);
  }, [JSON.stringify(params)]);

  return <niagaraActor ref={actor} location={at} rotation={rotation} niagaraComponent={{ autoActivate: true }} />;
}
