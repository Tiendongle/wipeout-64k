// GLSL 300 es shaders for the single-WebGL2-context Wipeout scene + GPU DoF & Bloom.

export const SKY_VS = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.9999, 1.0);
}`;

export const SKY_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform float uAspect;
uniform float uTanHalfFov;
uniform float uWorldYaw;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamForward;
uniform float uBeat;
uniform float uTime;

layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outDepth;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 ray = normalize(
    uCamForward +
    uCamRight * (ndc.x * uAspect * uTanHalfFov) +
    uCamUp * (ndc.y * uTanHalfFov)
  );

  // Spherical angles in true 3D space (zero curve warping!)
  float az = atan(ray.x, -ray.z) + uWorldYaw;
  float el = asin(clamp(ray.y, -1.0, 1.0));

  // Wipeout pink / magenta / peach sunset sky gradient
  float h = clamp(el * 2.4 + 0.08, 0.0, 1.0);
  vec3 horizonCol = vec3(1.00, 0.78, 0.72);
  vec3 midPink    = vec3(0.98, 0.44, 0.68);
  vec3 zenithCol  = vec3(0.42, 0.14, 0.46);
  vec3 sky = mix(horizonCol, midPink, smoothstep(0.0, 0.42, h));
  sky = mix(sky, zenithCol, smoothstep(0.35, 1.0, h));

  // Below horizon haze (deep twilight violet so the elevated track pops cleanly)
  if (el < 0.0) {
    sky = mix(vec3(0.72, 0.42, 0.58), vec3(0.16, 0.07, 0.22), smoothstep(0.0, -0.32, el));
  }

  // Soft Wipeout sun disc + atmospheric glow
  vec3 sunDir = normalize(vec3(sin(0.35 - uWorldYaw), 0.19, -cos(0.35 - uWorldYaw)));
  float sunDot = max(0.0, dot(ray, sunDir));
  sky += vec3(1.0, 0.85, 0.72) * pow(sunDot, 12.0) * 0.35;
  sky += vec3(1.0, 0.96, 0.88) * smoothstep(0.9965, 0.9985, sunDot) * 0.65;

  // Distant crisp futuristic city skyline on cylinder at infinity (zero warping!)
  float cityBase = -0.025;
  float uCity = az * 14.0;
  float cell = floor(uCity);
  float fx = fract(uCity);

  // Two parallax/silhouette layers of towers
  float b1 = hash11(cell * 1.7 + 3.1);
  float h1 = (b1 > 0.25) ? (0.025 + pow(b1, 2.2) * 0.14) : 0.015;
  float w1 = step(0.10, fx) * step(fx, 0.90);

  float uCity2 = az * 26.0 + 4.3;
  float cell2 = floor(uCity2);
  float fx2 = fract(uCity2);
  float b2 = hash11(cell2 * 2.3 + 11.7);
  float h2 = (b2 > 0.32) ? (0.018 + pow(b2, 2.5) * 0.095) : 0.01;
  float w2 = step(0.12, fx2) * step(fx2, 0.88);

  // Far silhouette layer
  if (el > cityBase && el < cityBase + h1 && w1 > 0.5) {
    float grad = (el - cityBase) / max(0.001, h1);
    vec3 col1 = mix(vec3(0.40, 0.19, 0.42), vec3(0.58, 0.28, 0.50), grad);
    sky = mix(sky, col1, 0.72);
  }

  // Nearer sharper silhouette layer with tiny lit windows
  if (el > cityBase && el < cityBase + h2 && w2 > 0.5) {
    float grad = (el - cityBase) / max(0.001, h2);
    vec3 col2 = mix(vec3(0.20, 0.09, 0.26), vec3(0.34, 0.15, 0.38), grad);
    // Tiny subtle lit window dots
    float wx = fract(fx2 * 5.0);
    float wy = fract((el - cityBase) * 140.0);
    float winMask = step(0.3, wx) * step(wx, 0.7) * step(0.35, wy) * step(wy, 0.72);
    float winOn = step(0.76, hash11(floor(fx2 * 5.0) + cell2 * 13.0 + floor((el - cityBase) * 140.0) * 7.0));
    col2 += vec3(1.0, 0.78, 0.45) * winMask * winOn * (0.35 + 0.25 * uBeat);
    sky = mix(sky, col2, 0.88);
  }

  // Subtle horizon mist band
  float mist = exp(-abs(el) * 26.0);
  sky = mix(sky, vec3(1.0, 0.76, 0.74), mist * 0.35);

  outColor = vec4(sky, 1.0);
  outDepth = vec4(1.0, 1.0, 1.0, 1.0);
}`;

export const TRACK_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNorm;
layout(location = 2) in vec2 aUv;   // x: -1..1 across track (or >1 for barriers), y: worldS
layout(location = 3) in float aMat; // 0 = road, 1 = barrier wall, 2 = glowing rail

uniform mat4 uView;
uniform mat4 uProj;

out vec3 vNorm;
out vec2 vUv;
out float vMat;
out float vViewZ;
out vec3 vWorldPos;

void main() {
  vec4 vp = uView * vec4(aPos, 1.0);
  vWorldPos = aPos;
  vViewZ = -vp.z;
  vNorm = aNorm;
  vUv = aUv;
  vMat = aMat;
  gl_Position = uProj * vp;
}`;

export const TRACK_FS = `#version 300 es
precision highp float;
in vec3 vNorm;
in vec2 vUv;
in float vMat;
in float vViewZ;
in vec3 vWorldPos;

uniform float uBeat;
uniform vec3 uAccent;
uniform float uMaxDepth;
uniform vec3 uShipPos;
uniform float uStabFlash;
uniform float uRasterMode;
uniform float uStepPulse;
uniform float uTime;
uniform vec4 uPads[8];

layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outDepth;

void main() {
  vec3 col;
  vec3 n = normalize(vNorm);
  vec3 lightDir = normalize(vec3(0.35, 0.85, 0.4));
  float ndl = 0.55 + 0.45 * max(0.0, dot(n, lightDir));

  if (vMat < 0.5) {
    // Open Wipeout striped racing track
    float u = vUv.x; // -1..1
    float s = vUv.y;

    // Alternating transverse speed stripes
    float stripe = step(0.5, fract(s * 0.085));
    vec3 darkLane = vec3(0.11, 0.11, 0.16);
    vec3 lightLane = vec3(0.18, 0.18, 0.25);
    col = mix(darkLane, lightLane, stripe);

    // Subtle longitudinal racing lanes
    float laneLine = smoothstep(0.025, 0.01, abs(abs(u) - 0.36));
    col = mix(col, vec3(0.45, 0.47, 0.56), laneLine * 0.45);

    // Dashed center vector stripe
    float centerDash = step(0.42, fract(s * 0.14)) * smoothstep(0.045, 0.02, abs(u));
    col = mix(col, vec3(0.95, 0.95, 0.98), centerDash * 0.9);

    // Beat-synced Wipeout speed boost pads & disconnected-jump launch chevrons!
    for (int i = 0; i < 8; i++) {
      vec4 pd = uPads[i];
      if (pd.y > 0.1) {
        float ds = s - pd.x;
        if (abs(ds) < pd.y) {
          float isLaunch = pd.w;
          float padW = mix(0.32, 0.72, isLaunch);
          float padShape = smoothstep(padW + 0.04, padW - 0.02, abs(u));
          float endFade = smoothstep(pd.y, pd.y - 1.2, abs(ds));
          float chev = step(0.46, fract(ds * 0.36 - abs(u) * 2.5 - uTime * 3.8));
          vec3 basePad = isLaunch > 0.5
            ? mix(vec3(1.0, 0.16, 0.48), vec3(1.0, 0.88, 0.16), chev)
            : mix(vec3(0.0, 0.96, 1.0), vec3(1.0, 0.84, 0.12), chev);
          vec3 padCol = mix(basePad, vec3(1.0, 0.99, 0.96), pd.z * 0.58);
          float glowBoost = 1.35 + uBeat * 0.25 + pd.z * 1.05 + isLaunch * 0.28;
          col = mix(col, padCol * glowBoost, padShape * endFade);
        }
      }
    }

    // Crisp red/white edge curbs
    float curbMask = smoothstep(0.84, 0.87, abs(u));
    float curbStripe = step(0.5, fract(s * 0.18));
    vec3 curbCol = mix(vec3(0.95, 0.94, 0.92), vec3(0.96, 0.14, 0.32), curbStripe);
    col = mix(col, curbCol, curbMask);

    // Track 3 (Tracker Protocol) retro demoscene wireframe vector grid overlay synced to onStep!
    if (uRasterMode > 0.01) {
      float gx = smoothstep(0.05, 0.0, abs(fract(u * 4.0) - 0.5));
      float gz = smoothstep(0.06, 0.0, abs(fract(s * 0.16) - 0.5));
      float wire = max(gx, gz) * (0.28 + 0.55 * uStepPulse) * uRasterMode;
      col += uAccent * wire;
    }

    col *= ndl;

    // Soft altitude-aware ground-effect contact shadow (fades smoothly as craft floats over crests/jumps!)
    vec3 dp = vWorldPos - uShipPos;
    float altFade = smoothstep(4.6, 0.5, abs(dp.y));
    float shadowDist = length(vec2(dp.x * 0.52, dp.z * 0.28)) / (1.0 + abs(dp.y) * 0.16);
    float shadow = 1.0 - 0.56 * exp(-shadowDist * shadowDist * 1.15) * altFade;
    col *= shadow;
  } else if (vMat < 1.5) {
    // Side Chevron Barriers (iconic Wipeout diagonal hazard chevrons)
    float s = vUv.y;
    float h = vUv.x; // 0..1 height along wall
    float diag = fract(s * 0.16 + h * 1.15);
    float chev = step(0.5, diag);
    vec3 cA = vec3(0.97, 0.95, 0.92);
    vec3 cB = mix(vec3(0.98, 0.22, 0.36), vec3(1.0, 0.72, 0.08), step(0.5, fract(s * 0.012)));
    col = mix(cA, cB, chev);
    // Dark bottom trim & top cap
    col = mix(vec3(0.08, 0.08, 0.12), col, smoothstep(0.0, 0.14, h) * smoothstep(1.0, 0.86, h));
    col *= (0.65 + 0.35 * ndl);
  } else {
    // Glowing anti-grav side energy rail (Track 2 stabTriggers & Track 4 accentTrigger flash!)
    col = mix(vec3(0.05, 0.92, 1.0), uAccent, 0.45) * (1.25 + 0.45 * uBeat + 0.95 * uStabFlash);
  }

  // Distance atmospheric pink horizon fog
  float fog = smoothstep(150.0, 385.0, vViewZ);
  vec3 fogCol = vec3(0.98, 0.66, 0.72);
  col = mix(col, fogCol, fog);

  float d = clamp(vViewZ / uMaxDepth, 0.0, 1.0);
  outColor = vec4(col, 1.0);
  outDepth = vec4(d, d, d, 1.0);
}`;

export const SHIP_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNorm;
layout(location = 2) in vec3 aCol;
layout(location = 3) in float aEmissive;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;

out vec3 vNorm;
out vec3 vCol;
out float vEmissive;
out vec3 vWorldPos;
out float vViewZ;

void main() {
  vec4 wp = uModel * vec4(aPos, 1.0);
  vec4 vp = uView * wp;
  vWorldPos = wp.xyz;
  vViewZ = -vp.z;
  vNorm = normalize(mat3(uModel) * aNorm);
  vCol = aCol;
  vEmissive = aEmissive;
  gl_Position = uProj * vp;
}`;

export const SHIP_FS = `#version 300 es
precision highp float;
in vec3 vNorm;
in vec3 vCol;
in float vEmissive;
in vec3 vWorldPos;
in float vViewZ;

uniform vec3 uCamPos;
uniform vec3 uBeamColor;
uniform float uThrust;
uniform float uMaxDepth;

layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outDepth;

void main() {
  vec3 n = normalize(vNorm);
  vec3 v = normalize(uCamPos - vWorldPos);
  vec3 keyDir = normalize(vec3(0.45, 0.85, 0.3));
  vec3 rimDir = normalize(vec3(-0.6, 0.4, -0.7));

  float diff = max(0.0, dot(n, keyDir));
  float backDiff = max(0.0, dot(n, rimDir));
  vec3 h = normalize(keyDir + v);
  float spec = pow(max(0.0, dot(n, h)), 36.0);
  float fresnel = pow(1.0 - max(0.0, dot(n, v)), 3.0);

  // Subtle pink-sky ambient reflection on sleek Wipeout hull
  vec3 amb = mix(vec3(0.20, 0.16, 0.28), vec3(0.98, 0.72, 0.78), n.y * 0.5 + 0.5) * 0.45;
  vec3 lit = vCol * (amb + diff * 0.78 + backDiff * 0.25) + vec3(1.0, 0.94, 0.96) * spec * 0.45;
  lit += vec3(0.98, 0.58, 0.78) * fresnel * 0.28;

  // Glowing twin rear engine nozzles
  if (vEmissive > 0.5) {
    vec3 core = mix(uBeamColor, vec3(1.0, 0.98, 0.95), 0.65);
    lit = core * (1.8 + uThrust * 1.4);
  }

  float fog = smoothstep(180.0, 390.0, vViewZ);
  lit = mix(lit, vec3(0.98, 0.66, 0.72), fog);

  float d = clamp(vViewZ / uMaxDepth, 0.0, 1.0);
  outColor = vec4(lit, 1.0);
  outDepth = vec4(d, d, d, 1.0);
}`;

export const BEAM_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec2 aUv; // x: 0 (engine) -> 1 (tail), y: -1..1 across ribbon

uniform mat4 uView;
uniform mat4 uProj;

out vec2 vUv;
out float vViewZ;

void main() {
  vec4 vp = uView * vec4(aPos, 1.0);
  vViewZ = -vp.z;
  vUv = aUv;
  gl_Position = uProj * vp;
}`;

export const BEAM_FS = `#version 300 es
precision highp float;
in vec2 vUv;
in float vViewZ;

uniform vec3 uBeamColor;
uniform float uIntensity;
uniform float uTime;
uniform float uMaxDepth;

layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outDepth;

void main() {
  float t = vUv.x;          // 0 at nozzle, 1 at far tail
  float across = abs(vUv.y); // 0 at center core, 1 at outer edge

  // Continuous Wipeout plasma beam: hot white core + colored outer sheath
  float core = exp(-across * across * 14.0);
  float sheath = exp(-across * across * 3.2);
  float alongFade = pow(1.0 - t, 1.35) * smoothstep(0.0, 0.04, t + 0.03);

  // Subtle high-speed energy ripple down the continuous beam
  float pulse = 0.88 + 0.12 * sin(t * 28.0 - uTime * 38.0);

  // Fade cleanly before reaching camera near-plane so steep ramp launches never whiteout the lens!
  float nearFade = smoothstep(2.4, 8.2, vViewZ);
  vec3 col = mix(uBeamColor, vec3(1.0, 0.99, 0.96), core * 0.85);
  float alpha = (sheath * 0.72 + core * 0.95) * alongFade * nearFade * pulse * uIntensity;

  outColor = vec4(col * alpha * 1.45, alpha);
  float d = clamp(vViewZ / uMaxDepth, 0.0, 1.0);
  outDepth = vec4(d, d, d, alpha);
}`;

export const QUAD_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec2 aUv;
layout(location = 2) in float aGlow;

uniform mat4 uView;
uniform mat4 uProj;

out vec2 vUv;
out float vGlow;
out float vViewZ;

void main() {
  vec4 vp = uView * vec4(aPos, 1.0);
  vViewZ = -vp.z;
  vUv = aUv;
  vGlow = aGlow;
  gl_Position = uProj * vp;
}`;

export const QUAD_FS = `#version 300 es
precision highp float;
in vec2 vUv;
in float vGlow;
in float vViewZ;

uniform sampler2D uTex;
uniform float uMaxDepth;
uniform float uAlphaCut;

layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outDepth;

void main() {
  vec4 tex = texture(uTex, vUv);
  if (tex.a < uAlphaCut) discard;

  vec3 col = tex.rgb * (1.0 + vGlow * 0.85);
  float fog = smoothstep(155.0, 385.0, vViewZ);
  col = mix(col, vec3(0.98, 0.66, 0.72), fog * 0.85);

  float d = clamp(vViewZ / uMaxDepth, 0.0, 1.0);
  outColor = vec4(col, tex.a);
  outDepth = vec4(d, d, d, tex.a);
}`;

export const POST_VS = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export const BLOOM_EXTRACT_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
out vec4 outColor;
void main() {
  vec3 c = texture(uScene, vUv).rgb;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float maxC = max(c.r, max(c.g, c.b));
  float bright = max(lum, maxC * 0.85);
  float knee = smoothstep(0.60, 1.02, bright);
  outColor = vec4(c * knee, 1.0);
}`;

export const BLUR_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uDir;
out vec4 outColor;
void main() {
  vec3 sum = texture(uTex, vUv).rgb * 0.227027;
  sum += texture(uTex, vUv + uDir * 1.384615).rgb * 0.316216;
  sum += texture(uTex, vUv - uDir * 1.384615).rgb * 0.316216;
  sum += texture(uTex, vUv + uDir * 3.230769).rgb * 0.070270;
  sum += texture(uTex, vUv - uDir * 3.230769).rgb * 0.070270;
  outColor = vec4(sum, 1.0);
}`;

export const DOF_COMPOSITE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uDepth;
uniform sampler2D uBloom;
uniform vec2 uTexel;
uniform float uFocusDepth;
uniform float uDofStrength;
uniform float uBloomStrength;
uniform float uSpeedBlur;
uniform float uRasterMode;
uniform float uStepPulse;

out vec4 outColor;

// Compute smooth Circle of Confusion (0 = tack-sharp, 1 = max bokeh blur)
float getCoC(float d) {
  float diff = d - uFocusDepth;
  // Asymmetric: keep foreground & ship super crisp, gently blur far distance & horizon
  float range = (diff < 0.0) ? 0.085 : 0.26;
  float coc = clamp((abs(diff) - 0.025) / range, 0.0, 1.0);
  return coc * coc * uDofStrength;
}

// Precomputed 12-tap golden-angle Vogel-disk offsets (zero trig inside fragment loop!)
const vec2 VOGEL[12] = vec2[12](
  vec2(-0.2128,  0.1950), vec2( 0.0365, -0.4066), vec2( 0.3037,  0.3972),
  vec2(-0.5621, -0.1319), vec2( 0.5425, -0.3497), vec2(-0.2330,  0.6677),
  vec2(-0.2943, -0.7048), vec2( 0.7285,  0.3688), vec2(-0.8224,  0.2647),
  vec2( 0.4539, -0.7920), vec2( 0.2314,  0.9288), vec2(-0.8588, -0.5122)
);

void main() {
  vec3 centerCol = texture(uScene, vUv).rgb;
  float centerD = texture(uDepth, vUv).r;
  float centerCoC = getCoC(centerD);

  vec3 acc = centerCol;
  float wSum = 1.0;

  // High-quality 12-tap precomputed Vogel-disk bokeh gather with depth-aware weighting
  if (centerCoC > 0.015) {
    vec2 stepScale = (8.0 * centerCoC) * uTexel;
    for (int i = 0; i < 12; i++) {
      vec2 suv = clamp(vUv + VOGEL[i] * stepScale, vec2(0.001), vec2(0.999));
      float sd = texture(uDepth, suv).r;
      float w = (sd >= centerD - 0.015) ? 1.0 : getCoC(sd);
      acc += texture(uScene, suv).rgb * w;
      wSum += w;
    }
  }

  vec3 col = acc / wSum;

  // Track 4 (filterCutoffNormalized + accentTrigger) & Track 1 high-speed radial speed blur!
  if (uSpeedBlur > 0.01) {
    vec2 rad = vUv - vec2(0.5, 0.54);
    float edge = clamp(length(rad) * 1.35, 0.0, 1.0);
    vec2 stepUv = rad * (0.018 * uSpeedBlur * edge);
    vec3 rCol = (
      texture(uScene, clamp(vUv - stepUv, vec2(0.001), vec2(0.999))).rgb +
      texture(uScene, clamp(vUv - stepUv * 2.0, vec2(0.001), vec2(0.999))).rgb
    ) * 0.5;
    col = mix(col, rCol, 0.34 * uSpeedBlur * edge);
  }

  // Subtle restrained bloom composite
  vec3 bloom = texture(uBloom, vUv).rgb;
  col += bloom * uBloomStrength;

  // Track 3 (Tracker Protocol) crisp retro demoscene CRT raster scanlines synced to onStep!
  if (uRasterMode > 0.01) {
    float scan = sin(vUv.y * 720.0) * 0.5 + 0.5;
    col *= 1.0 - uRasterMode * (0.065 + 0.03 * uStepPulse) * (1.0 - scan);
  }

  // Clean gentle filmic shoulder (preserves Wipeout color vibrancy)
  col = col / (1.0 + col * 0.22);

  // Very light edge vignette
  vec2 q = vUv - 0.5;
  float vig = 1.0 - dot(q, q) * 0.28;
  col *= vig;

  outColor = vec4(col, 1.0);
}`;
