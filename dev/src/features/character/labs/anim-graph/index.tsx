import * as UE from 'ue';
import { useEffect, useRef, useState } from 'react';
import { LabStage } from '../../../../scenes/lab-stage/LabStage';
import { param, useFrame, useHudMessages, useHudState } from '../../../../shared/react';
import { MANNEQUIN_MESHES } from '../../entities/mannequin';

// Animation graphs written as JSX. A mannequin (a bare skeletal mesh component) whose graph changes shape, and a
// character whose graph mounts and unmounts while the character stays. A person drives the lab from its HUD
// (dev/ui/hud/AnimGraphLabHud.tsx: the shape, the graph variables, the running graph); an agent from outside through
// globalThis.animGraphLab (node tools/game.mjs "animGraphLab.setShape('machine')"): shape, the graph variables
// written every frame from React (mix, go, index, reach: the IK effector's forward offset), extraPose and characterGraph.

const ANIMS = '/Game/Characters/Mannequins/Anims/Unarmed';
const IDLE = `${ANIMS}/MM_Idle.MM_Idle`;
const JOG = `${ANIMS}/Jog/MF_Unarmed_Jog_Fwd.MF_Unarmed_Jog_Fwd`;
const LINKED = `${ANIMS}/ABP_Unarmed.ABP_Unarmed_C`;

export type Shape = 'clip' | 'blend' | 'machine' | 'blendList' | 'blendByBool' | 'layered' | 'slot' | 'ik' | 'linked';

// The nodes whose runtime state the HUD shows: the state machine's current state and weights, a blend list's weights.
const WATCHED_NODE = /(stateMachine|blendList)#([^[(,\s]+)/;

// The running graph as the HUD shows it: the node tree the engine reports and the watched node's runtime state.
function describe(graph: UE.VgeAnimInstance | null) {
  if (!graph) return { tree: '', node: null };
  const tree = graph.DescribeGraph();
  const watched = WATCHED_NODE.exec(tree);
  const node = watched ? graph.DescribeNode(watched[2]) : '';
  return { tree, node: node ? JSON.parse(node) : null };
}

function MannequinGraph({ shape, extraPose }: { shape: Shape; extraPose: boolean }) {
  if (shape === 'clip') return <clip sequence={IDLE} />;
  if (shape === 'blendList') {
    return (
      <blendList index={param('index')} blendTime={0.2}>
        <clip sequence={IDLE} />
        <clip sequence={JOG} />
      </blendList>
    );
  }
  if (shape === 'blendByBool') {
    return (
      <blendByBool active={param('go')} blendTime={0.2} transition="inertialization">
        <clip sequence={JOG} />
        <clip sequence={IDLE} />
      </blendByBool>
    );
  }
  // The jog on the spine and everything above it, the idle below.
  if (shape === 'layered') {
    return (
      <layered layers={[{ bone: 'spine_01' }]} weights={[param('mix')]}>
        <clip sequence={IDLE} />
        <clip sequence={JOG} />
      </layered>
    );
  }
  if (shape === 'slot') {
    return (
      <slot name="DefaultSlot">
        <clip sequence={IDLE} />
      </slot>
    );
  }
  // The right hand reaches to a point in front of the chest, `reach` cm further forward along the mesh's +Y.
  if (shape === 'ik') {
    return (
      <twoBoneIK ikBone="hand_r" effectorSpace="component" effectorLocation={[-20, param('reach'), 130]} jointTargetSpace="component" jointTargetLocation={[-60, 0, 110]} alpha={1}>
        <clip sequence={IDLE} />
      </twoBoneIK>
    );
  }
  // The Animation Blueprint as a node; extraPose adds a sibling pose, which rebuilds the graph around it.
  if (shape === 'linked') {
    return (
      <blendList index={param('index')} blendTime={0.2}>
        <linkedGraph instanceClass={LINKED} />
        {extraPose && <clip sequence={JOG} />}
      </blendList>
    );
  }
  if (shape === 'blend') {
    return (
      <blend alpha={param('mix')}>
        <clip sequence={IDLE} />
        <clip sequence={JOG} />
      </blend>
    );
  }
  return (
    <stateMachine entry="idle">
      <state name="idle">
        <clip sequence={IDLE} />
      </state>
      <state name="jog">
        <clip sequence={JOG} />
      </state>
      <transition from="idle" to="jog" when="go" duration={0.3} blend="inertialization" />
      <transition from="jog" to="idle" when="!go" duration={0.3} />
    </stateMachine>
  );
}

export function Scene() {
  const [shape, setShape] = useState<Shape>('clip');
  const [characterGraph, setCharacterGraph] = useState(true);
  const [extraPose, setExtraPose] = useState(false);
  const graph = useRef<UE.VgeAnimInstance>(null);
  const controls = useRef({ mix: 0, go: false, index: 0, reach: 30 });

  useEffect(() => {
    const lab = {
      setShape,
      setCharacterGraph,
      setExtraPose,
      setMix: (mix: number) => (controls.current.mix = mix),
      setGo: (go: boolean) => (controls.current.go = go),
      setIndex: (index: number) => (controls.current.index = index),
      setReach: (reach: number) => (controls.current.reach = reach),
      graph: () => graph.current,
    };
    (globalThis as any).animGraphLab = lab;
    return () => {
      if ((globalThis as any).animGraphLab === lab) delete (globalThis as any).animGraphLab;
    };
  }, []);

  useHudMessages((message) => {
    if (message.type === 'animGraph/shape') setShape(message.shape as Shape);
    if (message.type === 'animGraph/characterGraph') setCharacterGraph(Boolean(message.on));
    if (message.type === 'animGraph/extraPose') setExtraPose(Boolean(message.on));
    if (message.type === 'animGraph/variable') Object.assign(controls.current, { [String(message.name)]: message.value });
  });

  useHudState('animGraph/state', () => ({ shape, characterGraph, extraPose, ...controls.current, ...describe(graph.current) }));

  // Graph variables come from React every frame; the props bound to them (param) and the conditions read them.
  useFrame(() => {
    graph.current?.SetFloat('mix', controls.current.mix);
    graph.current?.SetBool('go', controls.current.go);
    graph.current?.SetInt('index', controls.current.index);
    graph.current?.SetFloat('reach', controls.current.reach);
  });

  return (
    <>
      <LabStage groundSize={10} camera={{ location: [-420, 0, 140], rotation: [-8, 0, 0] }} />
      <skeletalMeshComponent location={[0, -80, 0]} rotation={[0, 90, 0]} skeletalMeshAsset={MANNEQUIN_MESHES.manny}>
        <animGraph ref={graph}>
          <inertialize>
            <MannequinGraph shape={shape} extraPose={extraPose} />
          </inertialize>
        </animGraph>
      </skeletalMeshComponent>
      <character location={[0, 120, 100]} mesh={{ skeletalMeshAsset: MANNEQUIN_MESHES.quinn, location: [0, 0, -88], rotation: [0, -90, 0] }}>
        {characterGraph && (
          <animGraph>
            <clip sequence={JOG} />
          </animGraph>
        )}
      </character>
    </>
  );
}
