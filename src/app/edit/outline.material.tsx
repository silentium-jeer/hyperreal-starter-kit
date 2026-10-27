import { defineMaterial, param } from '../../shared/material';

const DEPTH_TOLERANCE_CM = 2;
const DEPTH_TOLERANCE_FRACTION = 0.002;
const OCCLUDED_ALPHA = 0.35;
const VISIBLE_ALPHA = 254 / 255;
const AXES: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

type Expression = ReturnType<typeof stencilAt>;

const pixelStep = <divide a={1} b={<viewSize />} />;
const uvAt = ([dx, dy]: readonly [number, number], distance: number) => <add a={<textureCoordinate />} b={<multiply a={[dx * distance, dy * distance]} b={pixelStep} />} />;
const channelR = (sceneTextureId: 'CustomStencil' | 'CustomDepth' | 'SceneDepth', uv?: ReturnType<typeof uvAt>) => <componentMask r input={<sceneTexture sceneTextureId={sceneTextureId} coordinates={uv} />} />;
const stencilAt = (offset: readonly [number, number], distance: number) => channelR('CustomStencil', uvAt(offset, distance));
const maxOf = (values: Expression[]) => values.reduce((a, b) => <max a={a} b={b} />);
const isSet = (value: Expression) => <step y={0.5} x={value} />;

const centre = channelR('CustomStencil');
const ring = (distance: number) => AXES.map((axis) => stencilAt(axis, distance));
const differs = (values: Expression[]) => maxOf(values.map((value) => isSet(<abs input={<subtract a={value} b={centre} />} />)));

const near = ring(1);
const onEdge = differs(near);

const neighbourId = maxOf(near);
const colourId = <linearInterpolate a={neighbourId} b={centre} alpha={isSet(centre)} />;
const outlineColour = <linearInterpolate a={param('selected', [0.945, 0.345, 0])} b={param('active', [1, 0.667, 0.251])} alpha={<saturate input={<subtract a={colourId} b={1} />} />} />;

const neighbourDepth = AXES.map((axis) => channelR('CustomDepth', uvAt(axis, 1))).reduce((a, b) => <min a={a} b={b} />);
const outlineDepth = <linearInterpolate a={neighbourDepth} b={channelR('CustomDepth')} alpha={isSet(centre)} />;
const sceneDepth = channelR('SceneDepth');
const tolerance = <add a={DEPTH_TOLERANCE_CM} b={<multiply a={sceneDepth} b={DEPTH_TOLERANCE_FRACTION} />} />;
const visible = <step y={outlineDepth} x={<add a={sceneDepth} b={tolerance} />} />;
const alpha = <multiply a={onEdge} b={<linearInterpolate a={OCCLUDED_ALPHA} b={VISIBLE_ALPHA} alpha={visible} />} />;

const sceneColour = <componentMask r g b input={<sceneTexture sceneTextureId="PostProcessInput0" />} />;

const outline = defineMaterial(
  <material
    materialDomain="PostProcess"
    blendableLocation="SceneColorAfterTonemapping"
    emissiveColor={<linearInterpolate a={sceneColour} b={outlineColour} alpha={alpha} />}
  />,
);
export default outline;
