// Surface light of fixtures and LED strips (feature 003, research R7/R10). Data layout: see surfaceLighting.ts.

#ifndef MAX_LIGHTS
#define MAX_LIGHTS 64
#endif
#ifndef MAX_SEGMENTS
#define MAX_SEGMENTS 192
#endif

uniform int uLightCount;
// 4 texels per light (row = light): [pos.xyz, range] [dir.xyz, cos(outer half-angle) or -2 for omni]
// [color.rgb, softness] [goboTile, goboRotation, prismFacets + prismSpread / 100, prismRotation]
uniform highp sampler2D uLightData;
uniform int uSegmentCount;
// 3 texels per segment (row = segment): [start.xyz, 0] [end.xyz, 0] [color.rgb, packed normal]
uniform highp sampler2D uSegmentData;
uniform sampler2D uGoboAtlas;
uniform vec3 uAmbientColor;
uniform vec3 uOverflowLight;
uniform highp sampler2D uShadowAtlas;
uniform int uShadowTiles;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

// GOBO: cookie of light `index` for the direction `toFragment` (normalized); 1.0 = open (filled in by US1).
float slGobo(int index, vec3 toFragment, vec3 lightDirection, vec4 goboData) {
    return 1.0;
}

// SHADOW: visibility of the fragment from light `index`; 1.0 = lit (filled in by US3).
float slShadow(int index, vec3 worldPosition) {
    return 1.0;
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
        if (dirCone.w > -1.5) {
            // spot
            float cosAngle = dot(l, dirCone.xyz);
            if (cosAngle <= dirCone.w) {
                continue;
            }
            float outer = acos(clamp(dirCone.w, -1.0, 1.0));
            float cosInner = cos(outer * (1.0 - clamp(colorSoftness.w, 0.02, 1.0)));
            cone = smoothstep(dirCone.w, cosInner, cosAngle);
            cone *= slGobo(i, l, dirCone.xyz, texelFetch(uLightData, ivec2(3, i), 0));
        }
        surfaceLight += colorSoftness.rgb * (cone * lambert * slFalloff(d, posRange.w) * slShadow(i, vWorldPosition));
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
