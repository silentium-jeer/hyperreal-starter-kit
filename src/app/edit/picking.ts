import * as UE from 'ue';
import { $ref, $unref } from 'puerts';
import { nodeOfObject, packedWorldTransformOf, shownPackedNodes, type HostNode } from '../../shared/react/renderer';

const SAME_INSTANCE_CM = 0.5;

function meshPathOf(node: HostNode) {
  const mesh = node.props.staticMesh;
  if (typeof mesh === 'string') return mesh;
  return mesh instanceof UE.Object ? UE.KismetSystemLibrary.GetPathName(mesh) : undefined;
}

function packedNodeAt(component: UE.InstancedStaticMeshComponent, index: number) {
  const transform = $ref(new UE.Transform());
  if (!component.GetInstanceTransform(index, transform, true)) return undefined;
  const location = $unref(transform).GetLocation();
  const mesh = component.StaticMesh ? UE.KismetSystemLibrary.GetPathName(component.StaticMesh) : undefined;
  const matches: HostNode[] = [];
  for (const node of shownPackedNodes()) {
    const nodePath = meshPathOf(node);
    if (nodePath && mesh && nodePath !== mesh) continue;
    if (UE.KismetMathLibrary.Vector_Distance(packedWorldTransformOf(node).GetLocation(), location) <= SAME_INSTANCE_CM) matches.push(node);
  }
  if (matches.length > 1) console.log(`[edit] ${matches.length} packed elements share that instance's place; the first is selected`);
  return matches[0];
}

export function nodeUnderCursor(controller: UE.PlayerController): HostNode | undefined {
  const hit = $ref(new UE.HitResult());
  if (!controller.GetHitResultUnderCursorByChannel(UE.ETraceTypeQuery.TraceTypeQuery1, true, hit)) return undefined;
  const result = $unref(hit);
  const component = result.Component as UE.PrimitiveComponent | undefined;
  if (!component) return undefined;
  if (component instanceof UE.InstancedStaticMeshComponent && !nodeOfObject(component)) return packedNodeAt(component, result.Item);
  return nodeOfObject(component) ?? (component.GetOwner() ? nodeOfObject(component.GetOwner()) : undefined);
}
