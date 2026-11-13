//
// Description : Array and textureless GLSL 2D/3D/4D simplex
//               noise functions.
//      Author : Ian McEwan, Ashima Arts.
//  Maintainer : stegu
//     Lastmod : 20201014 (stegu)
//     License : Copyright (C) 2011 Ashima Arts. All rights reserved.
//               Distributed under the MIT License. See LICENSE file.
//               https://github.com/ashima/webgl-noise
//               https://github.com/stegu/webgl-noise
//

vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
  return mod289(((x * 34.0) + 10.0) * x);
}

vec4 taylorInvSqrt(vec4 r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  // First corner
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  // Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
  vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

  // Permutations
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  // Gradients: 7x7 points over a square, mapped onto an octahedron.
  // The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
  float n_ = 0.142857142857; // 1.0/7.0
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);    // mod(j,N)

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  //Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  // Mix final noise value
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// ---------------------------------------------------------------------------------------------------------------
// Volumetric beam (feature 003, research R8), derived from movingHead/beam.fragment.glsl.
// ---------------------------------------------------------------------------------------------------------------

#include <clipping_planes_pars_fragment>

/** Maximum haze octaves (quality "high"); uHazeOctaves selects 1..BEAM_MAX_OCTAVES. */
#define BEAM_MAX_OCTAVES 4
/** Gobo samples along the view chord through the cone. */
#define BEAM_CHORD_SAMPLES 4
/** Gobo atlas grid (GOBO_ATLAS_GRID in lighting/goboAtlas.ts). */
#define GOBO_GRID 8.0
/** Radius of the light-passing circle inside a tile, in tile uv (goboAtlas.ts RADIUS; SL_GOBO_RADIUS). */
#define GOBO_RADIUS 0.46
/** Half a texel at GOBO_LOD (4 texels of the 256 px tile). */
#define GOBO_TILE_MARGIN 0.0078125
/** Atlas mip level used for the in-beam gobo (soft, cheap). */
#define GOBO_LOD 2.0

uniform vec3 color;             // beam color (linear RGB, not multiplied by intensity)
uniform float topRadius;        // lens radius, mesh-local units
uniform float angle;            // full beam angle, degrees
uniform float time;             // seconds
uniform float fogFactor;        // haze noise scale (larger = bigger swirls)
uniform float fogTurbulence;    // haze noise speed

uniform float uIntensity;       // 0..1 (may exceed 1 for boost)
uniform float uLength;          // beam length, mesh-local units
uniform float uHaze;            // effective haze 0..1
uniform int uHazeOctaves;       // 1..BEAM_MAX_OCTAVES
uniform sampler2D uGoboAtlas;
uniform float uGoboTile;        // atlas tile, < 0 = open
uniform float uGoboRotation;    // radians
uniform vec3 uSplitColor;       // second half color of a split wheel slot
uniform bool uHasSplit;
uniform highp sampler2D uShadowAtlas; // SurfaceLighting shadow depth atlas (quality "high")
uniform float uShadowTile;      // this beam's light tile in the atlas, < 0 = no shadow
uniform mat4 uShadowMatrix;     // the tile's view-projection matrix

varying vec3 vLocal;
varying vec3 vCamLocal;
varying vec3 vWorld;
varying float vFacetGain;

/** Turbulent haze density from simplex octaves, normalized to 0..~1 independent of the octave count. */
float fogging(vec3 coord) {
  float fog = 0.0;
  float weight = 1.0;
  float total = 0.0;
  for (int o = 0; o < BEAM_MAX_OCTAVES; o++) {
    if (o >= uHazeOctaves) {
      break;
    }
    fog += abs(snoise(coord)) * weight;
    total += weight;
    coord *= 2.0;
    weight *= 0.5;
  }
  return total > 0.0 ? fog / total : 1.0;
}

float coneRadius(float z) {
  float halfAngle = radians(clamp(angle, 0.1, 170.0) * 0.5);
  return topRadius + tan(halfAngle) * clamp(z, 0.0, uLength);
}

/** Shadow atlas layout (shadowAtlas.ts; same as SL_SHADOW_* in surfaceLighting.frag). */
#define SHADOW_GRID 4
#define SHADOW_TILE_TEXELS 512
/** Depth bias as a share of the light's range (linear depth). */
#define SHADOW_BIAS 0.002

/** View-space depth along the light axis for NDC depth ndcZ (slShadowViewDepth in surfaceLighting.frag). */
float shadowViewDepth(mat4 m, float ndcZ) {
  vec3 row2 = vec3(m[0][2], m[1][2], m[2][2]);
  vec3 row3 = vec3(m[0][3], m[1][3], m[2][3]);
  float a = -dot(row2, row3);
  float b = m[3][2] + a * m[3][3];
  return b / (ndcZ + a);
}

/** 1 in front of the first occluder seen from the beam's light, 0 behind it (2x2 PCF); 1 without a shadow tile. */
float beamShadow(vec3 world) {
  if (uShadowTile < -0.5) {
    return 1.0;
  }
  vec4 clip = uShadowMatrix * vec4(world, 1.0);
  if (clip.w <= 1e-4) {
    return 1.0;
  }
  vec3 ndc = clip.xyz / clip.w;
  if (abs(ndc.x) >= 1.0 || abs(ndc.y) >= 1.0 || ndc.z >= 1.0) {
    return 1.0;
  }
  float depth = clip.w - SHADOW_BIAS * shadowViewDepth(uShadowMatrix, 1.0);
  int tile = int(uShadowTile + 0.5);
  float tileTexels = float(SHADOW_TILE_TEXELS);
  vec2 origin = vec2(float(tile % SHADOW_GRID), float(tile / SHADOW_GRID)) * tileTexels;
  vec2 texel = (ndc.xy * 0.5 + 0.5) * tileTexels - 0.5;
  vec2 base = floor(texel);
  vec2 f = texel - base;
  vec4 lit;
  for (int k = 0; k < 4; k++) {
    vec2 offset = vec2(float(k & 1), float(k >> 1));
    ivec2 p = ivec2(origin + clamp(base + offset, vec2(0.0), vec2(tileTexels - 1.0)));
    float occluder = shadowViewDepth(uShadowMatrix, texelFetch(uShadowAtlas, p, 0).r * 2.0 - 1.0);
    lit[k] = depth <= occluder ? 1.0 : 0.0;
  }
  return mix(mix(lit.x, lit.y, f.x), mix(lit.z, lit.w, f.x), f.y);
}

/** Gobo transmission at cross-section coordinate c (unit disc = beam edge). */
float goboAt(vec2 c) {
  if (uGoboTile < 0.0) {
    return 1.0;
  }
  float cs = cos(uGoboRotation);
  float sn = sin(uGoboRotation);
  vec2 r = vec2(cs * c.x - sn * c.y, sn * c.x + cs * c.y);
  // same mapping as slGobo in surfaceLighting.frag: the beam edge is the edge of the tile's light circle; clamped
  // inside the tile so filtering never reads the neighbouring tile
  vec2 uv = clamp(r * GOBO_RADIUS + 0.5, vec2(GOBO_TILE_MARGIN), vec2(1.0 - GOBO_TILE_MARGIN));
  float tile = floor(uGoboTile + 0.5);
  vec2 cell = vec2(mod(tile, GOBO_GRID), floor(tile / GOBO_GRID));
  return textureLod(uGoboAtlas, (cell + uv) / GOBO_GRID, GOBO_LOD).r;
}

void main() {
  #include <clipping_planes_fragment>

  float radius = max(coneRadius(vLocal.z), 1e-4);

  // View ray through the cone (facet space). Its closest approach to the beam axis gives the path length through
  // the cone (density) and the chord along which the gobo and split colors are sampled.
  vec3 rayDir = vLocal - vCamLocal;
  float rayLen = length(rayDir);
  rayDir = rayLen > 1e-6 ? rayDir / rayLen : vec3(0.0, 0.0, 1.0);
  float planar = dot(rayDir.xy, rayDir.xy);
  float tClosest = planar > 1e-6 ? -dot(vCamLocal.xy, rayDir.xy) / planar : rayLen;
  vec3 closest = vCamLocal + rayDir * tClosest;
  float offAxis = clamp(length(closest.xy) / radius, 0.0, 1.0);
  float density = sqrt(1.0 - offAxis * offAxis);
  float halfChord = planar > 1e-6 ? radius * density / sqrt(planar) : 0.0;

  vec3 light = vec3(0.0);
  for (int k = 0; k < BEAM_CHORD_SAMPLES; k++) {
    float s = (float(k) + 0.5) / float(BEAM_CHORD_SAMPLES) * 2.0 - 1.0;
    vec3 p = closest + rayDir * (halfChord * s);
    vec2 c = p.xy / max(coneRadius(p.z), 1e-4);
    vec3 sampleColor = (uHasSplit && c.x < 0.0) ? uSplitColor : color;
    light += sampleColor * goboAt(c);
  }
  light /= float(BEAM_CHORD_SAMPLES);

  // attenuation along the beam, flatter when looking into it (from the original shader)
  float axial = max(vLocal.z, 0.0);
  vec3 toCamera = normalize(vCamLocal + vec3(0.0, 0.0, 1e-4));
  float alignment = 1.0 - abs(toCamera.z);
  float attenuation = min(2.0 / (1.0 + alignment * axial + radians(clamp(angle, 0.1, 170.0) * 0.5) * axial * axial), 2.0);

  // haze: overall opacity and turbulence both scale with the haze amount
  float haze = clamp(uHaze, 0.0, 1.0);
  float hazeAlpha = mix(0.03, 1.0, pow(haze, 0.7));
  float fogScale = 0.4 / max(fogFactor, 0.01);
  vec3 fogCoord = vWorld * fogScale + vec3(0.0, 0.0, time * 0.1 * fogTurbulence * (0.25 + haze));
  float fog = mix(1.0, fogging(fogCoord) * 1.6, 0.25 + 0.6 * haze);

  // fade out over the last 5 % of the (clamped) length
  float fade = 1.0 - smoothstep(0.95, 1.0, vLocal.z / max(uLength, 1e-4));

  // cut off behind the first occluder in the light's shadow tile (quality "high")
  float shadow = beamShadow(vWorld);

  float energy = uIntensity * vFacetGain * attenuation * density * fog * fade * hazeAlpha * shadow;
  gl_FragColor = vec4(light * energy, 1.0);
}
