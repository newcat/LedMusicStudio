// LED strip pixels (feature 003, research R10): round points with a size in world units.
// `color` is the normalized Uint8 pixel color (vertexColors), `isOrthographic` comes from three.

uniform float uPointSize;      // world units (pitch × pixelSize)
uniform float uViewportHeight; // drawing buffer pixels
uniform float uMinPointSize;   // drawing buffer pixels (1.5 CSS px × pixel ratio)

varying vec3 vColor;

void main() {
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // projected size of uPointSize at this depth, in drawing buffer pixels
    float scale = projectionMatrix[1][1] * uViewportHeight * 0.5;
    float size = isOrthographic ? uPointSize * scale : uPointSize * scale / max(-mvPosition.z, 1e-4);
    gl_PointSize = max(size, uMinPointSize);
}
