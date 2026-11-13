// Shared particle sprite: a soft round dot. Define `ADDITIVE` for additive blending (color only, black adds
// nothing); without it the sprite uses normal blending with the falloff as alpha.

varying vec3 vColor;

void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float d = dot(c, c);
    if (d > 1.0) {
        discard;
    }
    // bright core, soft edge
    float falloff = 1.0 - smoothstep(0.15, 1.0, d);
#ifdef ADDITIVE
    gl_FragColor = vec4(vColor * falloff, 1.0);
#else
    gl_FragColor = vec4(vColor, falloff);
#endif
}
