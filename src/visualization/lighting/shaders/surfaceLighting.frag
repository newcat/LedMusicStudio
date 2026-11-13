// Surface light of fixtures and LED strips (feature 003, research R7/R10). Data layout: see surfaceLighting.ts.

#ifndef MAX_LIGHTS
#define MAX_LIGHTS 64
#endif
#ifndef MAX_SEGMENTS
#define MAX_SEGMENTS 192
#endif
// MAX_SHADOW_LIGHTS in shadowAtlas.ts
#define SL_MAX_SHADOW_LIGHTS 8

uniform int uLightCount;
// 4 texels per light (row = light): [pos.xyz, range] [dir.xyz, cos(outer half-angle) or -2 for omni]
// [color.rgb, softness] [goboTile + 128 * (shadowTile + 1), goboRotation, prismFacets + prismSpread / 100, prismRotation]
uniform highp sampler2D uLightData;
uniform int uSegmentCount;
// 3 texels per segment (row = segment): [start.xyz, 0] [end.xyz, 0] [color.rgb, packed normal]
uniform highp sampler2D uSegmentData;
uniform sampler2D uGoboAtlas;
uniform vec3 uAmbientColor;
uniform vec3 uOverflowLight;
// Shadow depth atlas (shadowAtlas.ts): 4x4 tiles of 512 px; uShadowTiles[tile] = the light's view-projection matrix.
uniform highp sampler2D uShadowAtlas;
uniform mat4 uShadowTiles[SL_MAX_SHADOW_LIGHTS];

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

// Gobo atlas layout (goboAtlas.ts): 8x8 tiles of 256 px, light passes inside a circle of radius 0.46 of a tile.
#define SL_GOBO_GRID 8.0
#define SL_GOBO_TILE_TEXELS 256.0
#define SL_GOBO_RADIUS 0.46
#define SL_GOBO_MAX_LOD 3.0
#define SL_MAX_FACETS 8
#define SL_TAU 6.28318530718

// Orthonormal light-space basis around the beam axis `n`; the up vector avoids degeneracy.
void slBasis(vec3 n, out vec3 t, out vec3 b) {
    vec3 up = abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    t = normalize(cross(up, n));
    b = cross(n, t);
}

// GOBO: cookie for the direction `l` (normalized, light -> fragment) in the beam frame (n, t, b); 1.0 = open.
// The cone edge maps to the edge of the tile's light circle. `footprint` = world size of the pixel (mip level).
float slGobo(vec3 l, vec3 n, vec3 t, vec3 b, float tanOuter, float dist, float footprint, vec4 goboData) {
    if (goboData.x < -0.5) {
        return 1.0;
    }
    float axial = dot(l, n);
    if (axial <= 1e-4) {
        return 0.0;
    }
    vec2 p = vec2(dot(l, t), dot(l, b)) / (axial * tanOuter);
    float c = cos(goboData.y);
    float s = sin(goboData.y);
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    // clamp inside the tile so linear filtering never reads the neighbouring tile
    float halfTexel = 0.5 / SL_GOBO_TILE_TEXELS;
    vec2 local = clamp(p * SL_GOBO_RADIUS + 0.5, vec2(halfTexel), vec2(1.0 - halfTexel));
    float tile = floor(goboData.x + 0.5);
    vec2 origin = vec2(mod(tile, SL_GOBO_GRID), floor(tile / SL_GOBO_GRID));
    vec2 uv = (origin + local) / SL_GOBO_GRID;
    // explicit LOD: derivatives are undefined inside the non-uniform light loop
    float texelsPerMeter = SL_GOBO_TILE_TEXELS * SL_GOBO_RADIUS / max(dist * axial * tanOuter, 1e-4);
    float lod = clamp(log2(max(footprint * texelsPerMeter, 1.0)), 0.0, SL_GOBO_MAX_LOD);
    return textureLod(uGoboAtlas, uv, lod).r;
}

// Spot cone times gobo cookie; with a prism (facets >= 3) the average over the facet beams, each tilted outward
// by the prism spread around an axis at prismRotation + k * 2pi / facets (total energy unchanged).
float slSpotCone(vec3 l, float dist, vec3 n, float cosOuter, float softness, vec4 goboData, float footprint) {
    float outer = acos(clamp(cosOuter, -1.0, 1.0));
    float cosInner = cos(outer * (1.0 - clamp(softness, 0.02, 1.0)));
    float tanOuter = tan(clamp(outer, 1e-3, 1.5));
    vec3 t;
    vec3 b;
    slBasis(n, t, b);
    float facets = floor(goboData.z);
    if (facets < 3.0) {
        float cosAngle = dot(l, n);
        if (cosAngle <= cosOuter) {
            return 0.0;
        }
        return smoothstep(cosOuter, cosInner, cosAngle) * slGobo(l, n, t, b, tanOuter, dist, footprint, goboData);
    }
    facets = min(facets, float(SL_MAX_FACETS));
    float spread = radians(fract(goboData.z) * 100.0);
    if (dot(l, n) <= cos(min(outer + spread, 3.14159))) {
        return 0.0;
    }
    float cs = cos(spread);
    float ss = sin(spread);
    float sum = 0.0;
    for (int k = 0; k < SL_MAX_FACETS; k++) {
        if (float(k) >= facets) {
            break;
        }
        float a = goboData.w + float(k) * SL_TAU / facets;
        float ca = cos(a);
        float sa = sin(a);
        vec3 o = ca * t + sa * b; // outward direction of this facet
        vec3 q = ca * b - sa * t; // tilt axis (cross(n, o)), unchanged by the tilt
        vec3 nk = cs * n + ss * o;
        float cosAngle = dot(l, nk);
        if (cosAngle <= cosOuter) {
            continue;
        }
        // rigidly rotated frame, so each facet projects the same (rotated) gobo image
        vec3 ok = cs * o - ss * n;
        vec3 tk = ca * ok - sa * q;
        vec3 bk = sa * ok + ca * q;
        sum += smoothstep(cosOuter, cosInner, cosAngle) * slGobo(l, nk, tk, bk, tanOuter, dist, footprint, goboData);
    }
    return sum / facets;
}

// Shadow atlas layout (shadowAtlas.ts): SL_SHADOW_GRID x SL_SHADOW_GRID tiles of SL_SHADOW_TILE_TEXELS.
#define SL_SHADOW_GRID 4
#define SL_SHADOW_TILE_TEXELS 512
// Texel 3.x packs goboTile + SL_SHADOW_TILE_STRIDE * (shadowTile + 1) (SHADOW_TILE_STRIDE in surfaceLighting.ts).
#define SL_SHADOW_TILE_STRIDE 128.0
// Depth bias as a share of the light's range (linear depth), raised at grazing angles.
#define SL_SHADOW_BIAS 0.002

// View-space distance along the light axis for the NDC depth `ndcZ`, using the perspective part of the light's
// view-projection matrix `m` (rows 2 and 3 of P * V give A = P[2][2] and B = P[3][2]; the view part is rigid).
float slShadowViewDepth(mat4 m, float ndcZ) {
    vec3 row2 = vec3(m[0][2], m[1][2], m[2][2]);
    vec3 row3 = vec3(m[0][3], m[1][3], m[2][3]);
    float a = -dot(row2, row3);
    float b = m[3][2] + a * m[3][3];
    return b / (ndcZ + a);
}

// SHADOW: visibility of `worldPosition` from the light that owns shadow tile `tile`; 1.0 = lit. 2x2 PCF on the
// tile's sub-rect, compared in linear depth with a bias of SL_SHADOW_BIAS of the range (x3 at grazing angles).
float slShadow(int tile, vec3 worldPosition, float lambert) {
    mat4 m = uShadowTiles[tile];
    vec4 clip = m * vec4(worldPosition, 1.0);
    if (clip.w <= 1e-4) {
        return 1.0;
    }
    vec3 ndc = clip.xyz / clip.w;
    if (abs(ndc.x) >= 1.0 || abs(ndc.y) >= 1.0 || ndc.z >= 1.0) {
        return 1.0;
    }
    float range = slShadowViewDepth(m, 1.0);
    float bias = SL_SHADOW_BIAS * range * (1.0 + 2.0 * (1.0 - clamp(lambert, 0.0, 1.0)));
    float depth = clip.w - bias;

    float tileTexels = float(SL_SHADOW_TILE_TEXELS);
    vec2 origin = vec2(float(tile % SL_SHADOW_GRID), float(tile / SL_SHADOW_GRID)) * tileTexels;
    vec2 texel = (ndc.xy * 0.5 + 0.5) * tileTexels - 0.5;
    vec2 base = floor(texel);
    vec2 f = texel - base;
    vec4 lit;
    for (int k = 0; k < 4; k++) {
        vec2 offset = vec2(float(k & 1), float(k >> 1));
        ivec2 p = ivec2(origin + clamp(base + offset, vec2(0.0), vec2(tileTexels - 1.0)));
        float occluder = slShadowViewDepth(m, texelFetch(uShadowAtlas, p, 0).r * 2.0 - 1.0);
        lit[k] = depth <= occluder ? 1.0 : 0.0;
    }
    return mix(mix(lit.x, lit.y, f.x), mix(lit.z, lit.w, f.x), f.y);
}

// Inverse-square falloff with a smooth cutoff at the range.
float slFalloff(float d, float range) {
    return (1.0 / (1.0 + d * d)) * (1.0 - smoothstep(range * 0.8, range, d));
}

// Strip falloff of the previous LED strip shader, times the term for the strip facing the fragment.
float slStripIntensity(vec3 stripPoint, vec3 stripNormal) {
    vec3 toFragment = vWorldPosition - stripPoint;
    float d = length(toFragment);
    float attenuation = 2.0 / (1.0 + d + 5.0 * d * d);
    vec3 lightDir = toFragment / max(d, 1e-5);
    float facing = pow(max(0.0, dot(lightDir, stripNormal)), 2.0);
    return clamp(attenuation * facing, 0.0, 1.0);
}

vec3 slUnpackNormal(float packedNormal) {
    int p = int(packedNormal + 0.5);
    vec3 q = vec3(float((p >> 16) & 255), float((p >> 8) & 255), float(p & 255));
    return normalize(q / 255.0 * 2.0 - 1.0);
}

void main() {
    vec3 slNormal = normalize(vWorldNormal) * (gl_FrontFacing ? 1.0 : -1.0);
    vec3 surfaceLight = vec3(0.0);
    // world size of this pixel, taken in uniform control flow (gobo mip level)
    float slFootprint = max(length(dFdx(vWorldPosition)), length(dFdy(vWorldPosition)));

    // fixture lights
    for (int i = 0; i < MAX_LIGHTS; i++) {
        if (i >= uLightCount) {
            break;
        }
        vec4 posRange = texelFetch(uLightData, ivec2(0, i), 0);
        vec3 toFragment = vWorldPosition - posRange.xyz;
        float d = length(toFragment);
        if (d >= posRange.w) {
            continue;
        }
        vec3 l = toFragment / max(d, 1e-5);
        float lambert = dot(slNormal, -l);
        if (lambert <= 0.0) {
            continue;
        }
        vec4 dirCone = texelFetch(uLightData, ivec2(1, i), 0);
        vec4 colorSoftness = texelFetch(uLightData, ivec2(2, i), 0);
        float cone = 1.0;
        float shadow = 1.0;
        if (dirCone.w > -1.5) {
            // spot (with gobo, prism and shadow tile)
            vec4 goboPrism = texelFetch(uLightData, ivec2(3, i), 0);
            float tilePlusOne = floor((goboPrism.x + 1.5) / SL_SHADOW_TILE_STRIDE);
            goboPrism.x -= SL_SHADOW_TILE_STRIDE * tilePlusOne;
            cone = slSpotCone(l, d, dirCone.xyz, dirCone.w, colorSoftness.w, goboPrism, slFootprint);
            if (cone <= 0.0) {
                continue;
            }
            if (tilePlusOne > 0.5) {
                shadow = slShadow(int(tilePlusOne + 0.5) - 1, vWorldPosition, lambert);
                if (shadow <= 0.0) {
                    continue;
                }
            }
        }
        surfaceLight += colorSoftness.rgb * (cone * lambert * slFalloff(d, posRange.w) * shadow);
    }

    // LED strip segments: closest point plus taps at Â±1/3 of the segment length, weighted by the segment length
    int segmentCount = min(uSegmentCount, MAX_SEGMENTS);
    for (int i = 0; i < MAX_SEGMENTS; i++) {
        if (i >= segmentCount) {
            break;
        }
        vec3 start = texelFetch(uSegmentData, ivec2(0, i), 0).xyz;
        vec3 end = texelFetch(uSegmentData, ivec2(1, i), 0).xyz;
        vec4 colorNormal = texelFetch(uSegmentData, ivec2(2, i), 0);
        if (dot(colorNormal.rgb, vec3(1.0)) <= 0.0) {
            continue;
        }
        vec3 stripNormal = slUnpackNormal(colorNormal.a);
        vec3 axis = end - start;
        float segmentLength = length(axis);
        vec3 dir = segmentLength > 1e-5 ? axis / segmentLength : vec3(0.0);
        float along = clamp(dot(vWorldPosition - start, dir), 0.0, segmentLength);
        float third = segmentLength / 3.0;
        float intensity = 0.5 * slStripIntensity(start + dir * along, stripNormal)
            + 0.25 * slStripIntensity(start + dir * clamp(along - third, 0.0, segmentLength), stripNormal)
            + 0.25 * slStripIntensity(start + dir * clamp(along + third, 0.0, segmentLength), stripNormal);
        surfaceLight += colorNormal.rgb * (intensity * max(segmentLength, 0.05));
    }

    csm_Emissive += surfaceLight + uAmbientColor + uOverflowLight;
}
