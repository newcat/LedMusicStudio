// LED strip pixels: a soft round dot, drawn additively (black pixels add nothing).

varying vec3 vColor;

void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float d = dot(c, c);
    if (d > 1.0) {
        discard;
    }
    // bright core, soft edge
    float falloff = 1.0 - smoothstep(0.15, 1.0, d);
    gl_FragColor = vec4(vColor * falloff, 1.0);
}
