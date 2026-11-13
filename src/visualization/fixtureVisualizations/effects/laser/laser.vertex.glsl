// Laser beams (feature 003, T062): plain GL lines (1 px, like LineBasicMaterial), one segment per beam.
// `aFade` is the brightness factor of the vertex: 1 at the nozzle and at a hit point, 0 at the far end of a beam
// that hits nothing (the beam fades out instead of ending abruptly).

attribute float aFade;

varying float vFade;

void main() {
    vFade = aFade;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
