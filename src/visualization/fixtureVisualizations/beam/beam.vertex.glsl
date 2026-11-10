// Volumetric beam cone (feature 003, research R8), derived from movingHead/beam.vertex.glsl.
//
// Geometry (createBeamGeometry in beamMaterial.ts): an open unit cone shell in beam space, position.xy = unit circle
// direction, position.z = 0 at the lens and 1 at the far end. The beam runs along the mesh's local +Z. One instance
// per prism facet (instance attribute aFacet = facet index).

#include <clipping_planes_pars_vertex>

#define BEAM_PI 3.1415926535897932384626433832795

attribute float aFacet;         // prism facet index of this instance

uniform float topRadius;        // lens radius, mesh-local units
uniform float angle;            // full beam angle, degrees
uniform float uLength;          // beam length (clamped to the first hit), mesh-local units
uniform float uFacets;          // prism facets; < 3 = no prism (only instance 0 draws)
uniform float uPrismSpread;     // outward tilt per facet, degrees
uniform float uPrismRotation;   // prism rotation, radians

varying vec3 vLocal;            // fragment position in (untilted) facet space, mesh-local units
varying vec3 vCamLocal;         // camera position in the same space
varying vec3 vWorld;            // world position (haze noise)
varying float vFacetGain;       // energy share of this facet

// Rodrigues rotation of v around the unit axis k by a radians.
vec3 rotateAround(vec3 v, vec3 k, float a) {
  float c = cos(a);
  float s = sin(a);
  return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
}

void main() {
  bool prism = uFacets >= 3.0;
  // instances beyond the active facet count collapse to one point outside the clip volume (draw nothing)
  if ((!prism && aFacet > 0.5) || (prism && aFacet > uFacets - 0.5)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vLocal = vec3(0.0);
    vCamLocal = vec3(0.0);
    vWorld = vec3(0.0);
    vFacetGain = 0.0;
    return;
  }

  float halfAngle = radians(clamp(angle, 0.1, 170.0) * 0.5);
  float farRadius = topRadius + tan(halfAngle) * uLength;
  float radius = mix(topRadius, farRadius, position.z);
  vec3 conePos = vec3(position.xy * radius, position.z * uLength);

  // prism: tilt the facet outward (toward phi) around the lens center
  vec3 tiltAxis = vec3(0.0, 0.0, 1.0);
  float tilt = 0.0;
  if (prism) {
    float phi = uPrismRotation + aFacet * 2.0 * BEAM_PI / uFacets;
    tiltAxis = vec3(-sin(phi), cos(phi), 0.0);
    tilt = radians(uPrismSpread);
  }
  vec3 transformed = rotateAround(conePos, tiltAxis, tilt);

  vec3 camMesh = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
  vCamLocal = rotateAround(camMesh, tiltAxis, -tilt);
  vLocal = conePos;
  vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vFacetGain = prism ? 1.0 / uFacets : 1.0;

  #include <project_vertex>
  #include <clipping_planes_vertex>
}
