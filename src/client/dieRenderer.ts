// Draws a die as one solid rounded cube. A single shared WebGL context ray-marches the shape and
// the result is copied into each die's own 2D canvas, so any number of dice can be on the table.

/** Half-widths of the square the die is drawn into, in die half-sizes: room for a cube seen corner-on. */
export const DIE_CANVAS_SCALE = 1.75;

const vertex = 'attribute vec2 corner; void main() { gl_Position = vec4(corner, 0., 1.); }';

// Axes follow CSS (x right, y down, z toward the viewer) so the cube's computed transform can be used as is.
// The corner radius and pip layout match the flat .die-flat face that takes over once the die has landed.
const fragment = `
precision highp float;
uniform float size;
uniform mat3 turn;
uniform vec3 base;
uniform vec3 pip;
uniform float faces[6];
const float RADIUS = .34;
const float EXTENT = ${DIE_CANVAS_SCALE.toFixed(2)};
const float PIP_STEP = .5067;
const float PIP_RADIUS = .157;

float body(vec3 p) {
  vec3 q = abs(p) - (1. - RADIUS);
  return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.) - RADIUS;
}

float pipCover(float value, vec2 at, float blur) {
  vec2 cell = clamp(floor(at / PIP_STEP + .5), -1., 1.);
  float index = (cell.y + 1.) * 3. + cell.x + 1.;
  bool center = index == 4.;
  bool falling = index == 0. || index == 8.;
  bool rising = index == 2. || index == 6.;
  bool middle = index == 3. || index == 5.;
  bool shown = value < 1.5 ? center : value < 2.5 ? falling : value < 3.5 ? (falling || center)
    : value < 4.5 ? (falling || rising) : value < 5.5 ? (falling || rising || center) : (falling || rising || middle);
  if (!shown) return 0.;
  return 1. - smoothstep(PIP_RADIUS - blur, PIP_RADIUS + blur, length(at - cell * PIP_STEP));
}

void main() {
  vec2 screen = (gl_FragCoord.xy / size * 2. - 1.) * EXTENT;
  screen.y = -screen.y;
  vec3 origin = vec3(screen, 3.) * turn;
  vec3 ray = vec3(0., 0., -1.) * turn;
  float travelled = 0.;
  bool hit = false;
  for (int step = 0; step < 48; step++) {
    float gap = body(origin + ray * travelled);
    if (gap < .0015) { hit = true; break; }
    travelled += gap;
    if (travelled > 6.) break;
  }
  if (!hit) { gl_FragColor = vec4(0.); return; }
  vec3 p = origin + ray * travelled;
  vec2 e = vec2(.002, 0.);
  vec3 normal = normalize(vec3(body(p + e.xyy) - body(p - e.xyy), body(p + e.yxy) - body(p - e.yxy), body(p + e.yyx) - body(p - e.yyx)));
  vec3 a = abs(p);
  float value;
  vec2 at;
  if (a.z >= a.x && a.z >= a.y) {
    if (p.z > 0.) { value = faces[0]; at = p.xy; } else { value = faces[1]; at = vec2(-p.x, p.y); }
  } else if (a.x >= a.y) {
    if (p.x > 0.) { value = faces[2]; at = vec2(-p.z, p.y); } else { value = faces[3]; at = vec2(p.z, p.y); }
  } else {
    if (p.y < 0.) { value = faces[4]; at = vec2(p.x, p.z); } else { value = faces[5]; at = vec2(p.x, -p.z); }
  }
  vec3 color = mix(base, pip, pipCover(value, at, 3. * EXTENT / size));
  vec3 facing = turn * normal;
  vec3 light = normalize(vec3(-.35, -.5, .8));
  // A face pointing straight at the viewer keeps its exact base color, so the landed die matches the flat one.
  float shade = clamp(.64 + .36 * dot(facing, light) / light.z, .46, 1.07);
  float shine = pow(max(dot(reflect(-light, facing), vec3(0., 0., 1.)), 0.), 26.) * .2;
  gl_FragColor = vec4(color * shade + shine, 1.);
}`;

interface Renderer {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  uniforms: Record<'size' | 'turn' | 'base' | 'pip' | 'faces', WebGLUniformLocation | null>;
}

let renderer: Renderer | null | undefined;

function create(): Renderer | null {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', { antialias: false });
  if (!gl) return null;
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
    const shader = gl.createShader(type);
    if (!shader || !program) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
    gl.attachShader(program, shader);
  }
  if (!program) return null;
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const corner = gl.getAttribLocation(program, 'corner');
  gl.enableVertexAttribArray(corner);
  gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
  const uniform = (name: string) => gl.getUniformLocation(program, name);
  canvas.addEventListener('webglcontextlost', () => { renderer = null; });
  return { canvas, gl, uniforms: { size: uniform('size'), turn: uniform('turn'), base: uniform('base'), pip: uniform('pip'), faces: uniform('faces') } };
}

function rgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.trim().replace('#', ''), 16);
  return [(value >> 16 & 255) / 255, (value >> 8 & 255) / 255, (value & 255) / 255];
}

/** The rotation part of a computed CSS transform, column by column. */
function rotation(transform: string) {
  const values = transform.slice(transform.indexOf('(') + 1).match(/-?[\d.]+(?:e-?\d+)?/g)?.map(Number);
  if (values?.length === 16) return [values[0], values[1], values[2], values[4], values[5], values[6], values[8], values[9], values[10]];
  if (values?.length === 6) return [values[0], values[1], 0, values[2], values[3], 0, 0, 0, 1];
  return [1, 0, 0, 0, 1, 0, 0, 0, 1];
}

/**
 * Paints the die into `target` as it is currently turned by `transform` (a computed CSS transform).
 * `faces` lists the values on the front, back, right, left, top, and bottom. Returns false when WebGL is unavailable.
 */
export function drawDie(target: HTMLCanvasElement, transform: string, faces: number[], base: string, pip: string) {
  if (renderer === undefined) {
    try { renderer = create(); } catch { renderer = null; }
  }
  const context = target.getContext('2d');
  if (!renderer || !context || renderer.gl.isContextLost()) return false;
  const { canvas, gl, uniforms } = renderer;
  // Rendering at twice the size and scaling down smooths the die's outline.
  const size = target.width * 2;
  if (canvas.width !== size) canvas.width = canvas.height = size;
  gl.viewport(0, 0, size, size);
  gl.uniform1f(uniforms.size, size);
  gl.uniformMatrix3fv(uniforms.turn, false, rotation(transform));
  gl.uniform3fv(uniforms.base, rgb(base));
  gl.uniform3fv(uniforms.pip, rgb(pip));
  gl.uniform1fv(uniforms.faces, faces);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  context.clearRect(0, 0, target.width, target.height);
  context.imageSmoothingQuality = 'high';
  context.drawImage(canvas, 0, 0, size, size, 0, 0, target.width, target.height);
  return true;
}
