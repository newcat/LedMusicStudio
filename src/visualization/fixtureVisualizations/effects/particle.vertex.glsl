// Shared particle points (feature 003, T060): round sprites with a size in world units.
// `color` is the particle color (vertexColors), `aSize` its world-space diameter (0 = dead slot, hidden),
// `isOrthographic` comes from three. Same size attenuation as ledPixels.vertex.glsl.

attribute float aSize;

uniform float uViewportHeight; // drawing buffer pixels
uniform float uMinPointSize;   // drawing buffer pixels (1.5 CSS px × pixel ratio)

varying vec3 vColor;

void main() {
    vColor = color;
    if (aSize <= 0.0) {
        // dead slot: clipped away
        gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
        gl_PointSize = 0.0;
        return;
    }
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // projected size of aSize at this depth, in drawing buffer pixels
    float scale = projectionMatrix[1][1] * uViewportHeight * 0.5;
    float size = isOrthographic ? aSize * scale : aSize * scale / max(-mvPosition.z, 1e-4);
    gl_PointSize = max(size, uMinPointSize);
}
