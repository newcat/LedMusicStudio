#include <clipping_planes_pars_vertex>

attribute float index;      //fragment index

uniform float vertexCount;  //Total vertex count
uniform float topRadius;    //Top radius of the cylinder
uniform float len;       //Maximum length of the cylinder
uniform vec3 direction;   //beam direction
uniform vec3 color;       //beam color
uniform float intensity;  //beam intensity
uniform vec3 angle;       //beam angle
uniform vec3 wpos;        //beam position

varying vec3 vPosition;         //Vertex local position
varying vec3 beamPos;
varying vec4 vWorldPosition;    //Vertex world position
varying vec2 vUv;               //UV position
varying vec3 vNormal;           //Vertex normal (not used here. recomputed in the vertex shader since vertex displacement is involved)
varying vec3 vDirection;        //Beam direction in worldspace coordinates
varying vec3 vColor;            //Beam color
varying float vIntensity;       //Beam intensity
varying float vAngle;           //Beam angle
varying float vIndex;           //Vertex index

/**
 * @function computeRadiusVertexScaleFactor
 * @brief Computes cylinder's bottom cap vertex displacement
 * needed in order to set the beam's angle at the provided value 
 * @param vec3 vector input vertex position vector
 * @returns vec3 the transformed vertex position vector
 */
vec3 computeRadiusVertexScaleFactor(vec3 vector) {
  if (index < vertexCount / 2.0) {
    vec3 center = vec3(0.0, len / 2.0, 0.0);
    vec3 centerOffset = vector - center;
    float currentDistance = length(centerOffset);
    float targetDistance = tan(radians(angle.x)) * len;
    float scaleFactor = targetDistance / currentDistance;
    return vector + (centerOffset * scaleFactor);
  }
  return vector;
}

void main() {
  #include <begin_vertex>
  #include <project_vertex>
  #include <clipping_planes_vertex>

  vDirection = direction;     //forwarding direction value to fragement shader
  beamPos = wpos;
  vColor = color;             //forwarding color value to fragement shader
  vIntensity = intensity;     //forwarding intensity value to fragement shader
  vAngle = angle.x;           //forwarding angle value to fragement shader
  vUv = uv;                   //forwarding UV values to fragement shader
  vIndex = index;             //forwarding vertex index to fragement shader
  vPosition = computeRadiusVertexScaleFactor(position);     //Displaing vertex position to match desired angle
  // vPosition = position;
  vWorldPosition = projectionMatrix * viewMatrix * modelMatrix * vec4(vPosition, 1.0);      //Determining vertex worldspace coordinates
  vNormal = vec3(viewMatrix * modelMatrix * vec4(normal, 0.0));  //Computing instance normal

  gl_Position = vWorldPosition;   //Setting up fragment world position 
}