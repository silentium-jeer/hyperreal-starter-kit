import { useEffect, useState } from 'react';
import { OrbitCamera } from '../../scenes/lab-stage/OrbitCamera';
import type { Vector3 } from '../../shared/react/props';
import { EditBindings, type Navigation } from './EditBindings';
import { TransformGizmo, type GizmoRefs, type PartLook } from './TransformGizmo';
import type { GizmoPart } from './gizmoParts';

export interface OverlayLook {
  parts: GizmoPart[];
  partLook: PartLook;
}

export interface OverlayRefs {
  gizmo: GizmoRefs;
}

export interface OverlayStore {
  look: OverlayLook;
  camera: { location: Vector3; rotation: Vector3 };
  listener?: (look: OverlayLook) => void;
}

export function EditOverlay({ store, refs }: { store: OverlayStore; refs: OverlayRefs }) {
  const [look, setLook] = useState(store.look);
  const [navigation, setNavigation] = useState<Navigation>();
  useEffect(() => {
    store.listener = setLook;
    return () => {
      store.listener = undefined;
    };
  }, [store]);
  return (
    <>
      <OrbitCamera location={store.camera.location} rotation={store.camera.rotation} editing navigation={navigation} />
      <EditBindings navigation={navigation} gizmoHovered={look.partLook.hovered !== undefined} navigate={setNavigation} />
      <TransformGizmo parts={look.parts} partLook={look.partLook} refs={refs.gizmo} />
    </>
  );
}
