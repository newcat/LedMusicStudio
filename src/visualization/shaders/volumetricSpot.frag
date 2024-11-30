varying vec3       vNormal;
varying vec3       vWorldPosition;
uniform vec3       lightColor;
uniform vec3       spotPosition;
uniform float      attenuation;
uniform float      anglePower;

void main() {
    float intensity;

    intensity = distance(vWorldPosition, spotPosition)/attenuation;
    intensity = 1.0 - clamp(intensity, 0.0, 1.0);
        
    vec3 normal = vec3(vNormal.x, vNormal.y, abs(vNormal.z));
    float angleIntensity = pow( dot(normal, vec3(0.0, 0.0, 1.0)), anglePower);
    intensity = intensity * angleIntensity;

    gl_FragColor = vec4( lightColor, intensity);
}