// Laser beams (feature 003, T062), additive: in clean air a beam is barely visible, in haze it is fully visible.

uniform vec3 uColor;     // linear RGB 0..1
uniform float uIntensity; // 0..1 (dimmer × shutter)
uniform float uHaze;     // effective haze 0..1
uniform float uGain;     // beam brightness for bloom

varying float vFade;

void main() {
    float alpha = mix(0.02, 1.0, pow(clamp(uHaze, 0.0, 1.0), 0.7));
    gl_FragColor = vec4(uColor * (uIntensity * alpha * uGain * vFade), 1.0);
}
