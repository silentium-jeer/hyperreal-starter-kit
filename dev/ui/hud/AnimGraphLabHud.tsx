import { post } from '../bridge'
import { ControlButton, ControlChoice, ControlPanel, ControlSlider } from '../features/ui-kit'
import styles from './LabHud.module.css'
import { useGameState } from './useGameState'

// The animation graph lab's HUD (dev/src/features/character/labs/anim-graph): pick the shape of Manny's graph, play with
// the variables that graph reads, and watch the graph the engine is running. Quinn's graph can be removed and put back.
type Shape = 'clip' | 'blend' | 'machine' | 'blendList' | 'blendByBool' | 'layered' | 'slot' | 'ik' | 'linked'
type NodeState = { type: string; state?: string; weights?: Record<string, number> | number[]; index?: number }
type AnimGraphState = {
  shape: Shape
  characterGraph: boolean
  extraPose: boolean
  mix: number
  go: boolean
  index: number
  reach: number
  tree: string
  node: NodeState | null
}

type Control = 'mix' | 'go' | 'index' | 'reach' | 'extraPose'
const SHAPES: { id: Shape; label: string; about: string; controls: Control[]; indexLabels?: string[] }[] = [
  { id: 'clip', label: 'Clip', about: 'One clip: the idle plays on its own.', controls: [] },
  { id: 'blend', label: 'Blend', about: 'Idle and jog mixed by one weight. Move Mix from idle to jog.', controls: ['mix'] },
  { id: 'machine', label: 'State machine', about: 'Two states, idle and jog. Jog switches the state; the transition is inertialized over 0.3 s.', controls: ['go'] },
  { id: 'blendList', label: 'Blend list', about: 'Picks one pose by index and blends to it over 0.2 s.', controls: ['index'], indexLabels: ['Idle', 'Jog'] },
  { id: 'blendByBool', label: 'Blend by bool', about: 'Jog on or off picks the pose, with an inertialized blend.', controls: ['go'] },
  { id: 'layered', label: 'Layered', about: 'The jog on the spine and above, the idle below. Mix sets the upper-body weight.', controls: ['mix'] },
  { id: 'slot', label: 'Slot', about: 'A montage slot over the idle: the idle shows until a montage plays in DefaultSlot.', controls: [] },
  { id: 'ik', label: 'Two-bone IK', about: 'The right hand reaches to a point in front of the chest. Reach moves the point forward.', controls: ['reach'] },
  { id: 'linked', label: 'Linked graph', about: 'The stock Animation Blueprint (ABP_Unarmed) as a node of the graph. Extra pose adds a jog beside it.', controls: ['index', 'extraPose'], indexLabels: ['Blueprint', 'Jog'] },
]

const percent = (value: number) => `${Math.round(value * 100)}%`
const variable = (name: string, value: number | boolean) => post({ type: 'animGraph/variable', name, value })

// The engine's tree "type#id[state](child, ...)" as indented lines, ids dropped: what a person needs is the shape.
function treeLines(tree: string) {
  const lines: string[] = []
  let depth = 0
  let current = ''
  const flush = () => {
    const text = current.trim().replace(/#[^[\s]+/, '')
    if (text) lines.push(`${'  '.repeat(depth)}${text}`)
    current = ''
  }
  for (const char of tree) {
    if (char === '(') {
      flush()
      depth += 1
    } else if (char === ')') {
      flush()
      depth -= 1
    } else if (char === ',') {
      flush()
    } else {
      current += char
    }
  }
  flush()
  return lines
}

function NodeWeights({ node }: { node: NodeState }) {
  const weights = Array.isArray(node.weights) ? node.weights.map((weight, index) => [`pose ${index}`, weight] as const) : Object.entries(node.weights ?? {})
  return (
    <div className={styles.weights} data-testid="anim-graph-weights">
      {node.state ? <div className={styles.line}>State: <strong>{node.state}</strong></div> : null}
      {weights.map(([name, weight]) => (
        <div className={styles.weight} key={name}>
          <span>{name}</span>
          <span className={styles.bar}><span style={{ width: percent(weight) }} /></span>
          <output>{percent(weight)}</output>
        </div>
      ))}
    </div>
  )
}

export function AnimGraphLabHud() {
  const state = useGameState<AnimGraphState>('animGraph/state')
  if (!state) return null
  const shape = SHAPES.find((entry) => entry.id === state.shape) ?? SHAPES[0]

  return (
    <>
      <div className={styles.corner} data-hit data-testid="anim-graph-hud">
        <ControlPanel maxWidth={340} title="Manny's graph" readout={shape.label}>
          <ControlChoice activeId={state.shape} label="Shape" onSelect={(id) => post({ type: 'animGraph/shape', shape: id })} options={SHAPES.map(({ id, label }) => ({ id, label }))} testIdPrefix="anim-graph-shape" />
          <p className={styles.about}>{shape.about}</p>
          {shape.controls.includes('mix') ? (
            <ControlSlider data-testid="anim-graph-mix" format={percent} label="Mix" max={1} min={0} onChange={(value) => variable('mix', value)} step={0.01} value={state.mix} />
          ) : null}
          {shape.controls.includes('go') ? (
            <ControlButton active={state.go} data-testid="anim-graph-go" onClick={() => variable('go', !state.go)} variant="accent">
              Jog
            </ControlButton>
          ) : null}
          {shape.controls.includes('index') ? (
            <ControlChoice activeId={String(state.index)} label="Pose" onSelect={(id) => variable('index', Number(id))} options={(shape.indexLabels ?? []).map((label, index) => ({ id: String(index), label }))} testIdPrefix="anim-graph-index" />
          ) : null}
          {shape.controls.includes('reach') ? (
            <ControlSlider data-testid="anim-graph-reach" format={(value) => `${Math.round(value)} cm`} label="Reach" max={60} min={-20} onChange={(value) => variable('reach', value)} step={1} value={state.reach} />
          ) : null}
          {shape.controls.includes('extraPose') ? (
            <ControlButton active={state.extraPose} data-testid="anim-graph-extra-pose" onClick={() => post({ type: 'animGraph/extraPose', on: !state.extraPose })}>
              Extra pose
            </ControlButton>
          ) : null}
        </ControlPanel>
        <ControlPanel maxWidth={340} title="Quinn">
          <p className={styles.about}>A character whose graph mounts and unmounts while the character stays.</p>
          <ControlButton active={state.characterGraph} data-testid="anim-graph-character" onClick={() => post({ type: 'animGraph/characterGraph', on: !state.characterGraph })}>
            {state.characterGraph ? 'Graph on: jog' : 'Graph off'}
          </ControlButton>
        </ControlPanel>
      </div>
      <div className={styles.rightCorner} data-hit data-testid="anim-graph-running">
        <ControlPanel maxWidth={360} title="Running graph">
          <pre className={styles.tree} data-testid="anim-graph-tree">{treeLines(state.tree).join('\n')}</pre>
          {state.node ? <NodeWeights node={state.node} /> : null}
        </ControlPanel>
      </div>
    </>
  )
}
