import * as UE from 'ue';
import { world } from '../../shared/engine/world';
import type { InputEvent } from '../../shared/input';
import type { HostNode } from '../../shared/react/renderer';
import { requestEdit } from './channel';
import { editState, isSelected, report, type Selected } from './editState';
import type { GizmoTool } from './gizmoParts';
import { nodeUnderCursor } from './picking';
import { inspect, selectedOf } from './propPlan';
import { startTransform } from './transform';

const controller = () => UE.GameplayStatics.GetPlayerController(world, 0) as UE.PlayerController;

export const editOverlay = { owns: (_node: HostNode) => false };

function editable(node: HostNode | undefined) {
  return node && !editOverlay.owns(node) && node.kind !== 'anim' ? node : undefined;
}

export function describeSelection(selected: Selected) {
  const levels = selected.inspected?.levels ?? [];
  return levels.length ? levels.map((level) => `<${level.tag}> ${level.file}:${level.line}`).join(' < ') : `<${selected.node.type}>`;
}

function setSelection(nodes: HostNode[]) {
  editState.selection = nodes.flatMap((node) => {
    const existing = editState.selection.find((selected) => selected.node === node);
    if (existing) return [existing];
    const selected = selectedOf(node);
    if (selected) void inspect(selected).then((inspected) => inspected && report(describeSelection(selected)));
    return selected ? [selected] : [];
  });
  if (!editState.selection.length) report('nothing selected');
}

export const reinspectSelection = () => editState.selection.forEach((selected) => void inspect(selected));

export function selectUnderCursor() {
  const node = editable(nodeUnderCursor(controller()));
  setSelection(node ? [node] : []);
}

export function toggleUnderCursor() {
  const node = editable(nodeUnderCursor(controller()));
  if (!node) return;
  const nodes = editState.selection.map((selected) => selected.node);
  setSelection(isSelected(node) ? nodes.filter((each) => each !== node) : [...nodes, node]);
}

export function setTool(tool: GizmoTool) {
  editState.tool = tool;
  report(`tool: ${tool}`);
}

export function dragGizmo(event: InputEvent) {
  const part = editState.hoveredPart;
  if (!part) return 'pass' as const;
  const constraint = part.constraint.some(Boolean) ? part.constraint : undefined;
  const operation = startTransform({ mode: part.mode, constraint, releaseConfirm: true, cursor: event.cursor ?? [0, 0] });
  return operation === 'cancelled' ? undefined : operation;
}

function history(op: 'undo' | 'redo') {
  void requestEdit<{ files: string[] }>(op)
    .then(({ files }) => report(`${op === 'undo' ? 'undid' : 'redid'} ${files.join(', ')}`))
    .catch((err) => report(`${op} refused: ${err.message}`));
}

export const undo = () => history('undo');
export const redo = () => history('redo');
