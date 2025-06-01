import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import CustomShaderMaterial from "three-custom-shader-material/vanilla";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.update();

const geometry = new THREE.PlaneGeometry(10, 10);
geometry.rotateX(-Math.PI / 2);
geometry.translate(0, 0.01, 0);

const LED_STRIPS = new Array(8).fill().map(() => ({
    start: new THREE.Vector3(0, 0, 0),
    end: new THREE.Vector3(0, 0, 0),
    direction: new THREE.Vector3(0, 0, 0),
    color: new Array(128).fill(new THREE.Color(0x00ff00)),
}));
LED_STRIPS[0] = {
    start: new THREE.Vector3(-5, 1.5, 3),
    end: new THREE.Vector3(5, -0.5, -3),
    direction: new THREE.Vector3(0, -1, 0).normalize(),
    color: new Array(128).fill().map((_, i) => new THREE.Color(i / 128, 1 - i / 128, 0.5)),
};

const colorTexture = new THREE.DataTexture(
    new Uint8Array(LED_STRIPS.flatMap((strip) => strip.color).flatMap((color) => [color.r * 255, color.g * 255, color.b * 255, 255])),
    128,
    LED_STRIPS.length
);
colorTexture.needsUpdate = true;

const csm = new CustomShaderMaterial({
    baseMaterial: THREE.MeshPhysicalMaterial,
    uniforms: {
        uNumLedStrips: { value: 1 },
        uLedStrips: {
            value: LED_STRIPS.map((strip) => ({
                start: strip.start,
                end: strip.end,
                direction: strip.direction,
            })),
        },
        uLedStripColors: { value: colorTexture },
    },
    vertexShader: `
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;

        void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
        }`,
    fragmentShader: `
#define MAX_LED_STRIPS 8

struct LedStrip {
    vec3 start;
    vec3 end;
    vec3 direction;
};

uniform int uNumLedStrips;
uniform LedStrip uLedStrips[MAX_LED_STRIPS];
uniform sampler2D uLedStripColors;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

float intensity(vec3 ledStripPoint, vec3 ledStripDirection) {
    float distanceToStrip = length(vWorldPosition - ledStripPoint);
    float attenuation = 1.0 / (1.0 + 10.1 * distanceToStrip + 10.01 * distanceToStrip * distanceToStrip);
    vec3 lightDir = normalize(vWorldPosition - ledStripPoint);
    float surfaceAngle = max(0.0, dot(lightDir, ledStripDirection));
    float intensity = attenuation * surfaceAngle;
    return intensity;
}

void main() {
    const float KERNEL[9] = float[](0.0002,	0.0060,	0.0606,	0.2417,	0.3829,	0.2417,	0.0606,	0.0060,	0.0002);
    const float SAMPLE_DISTANCE = 0.05; // 5% of strip length

    vec3 ledStripLight = vec3(0.0);
    for (int i = 0; i < uNumLedStrips; i++) {
        LedStrip strip = uLedStrips[i];
        vec3 dir = normalize(strip.end - strip.start);
        vec3 pos = vWorldPosition - strip.start;
        float stripLength = length(strip.end - strip.start);
        float distAlongStrip = clamp(dot(pos, dir), 0.0, stripLength);
        
        // Normalized position along strip (0.0 to 1.0)
        float normalizedPos = distAlongStrip / stripLength;
        
        vec3 closestPoint = strip.start + dir * distAlongStrip;
        float distanceToStrip = length(vWorldPosition - closestPoint);
    
        for (int j = -4; j <= 4; j++) {
            float samplePos = normalizedPos + float(j) * SAMPLE_DISTANCE;
            if (samplePos < 0.0 || samplePos > 1.0) continue; // Skip out of bounds
            
            int sampleIndex = int(samplePos * 127.0);
            vec3 sampleColor = texelFetch(uLedStripColors, ivec2(sampleIndex, i), 0).rgb;

            vec3 samplePoint = strip.start + dir * (samplePos * stripLength);
            float sampleDist = length(vWorldPosition - samplePoint);
            float sampleIntensity = clamp(intensity(samplePoint, strip.direction) * KERNEL[j + 4], 0.0, 1.0);

            ledStripLight += sampleColor * sampleIntensity;
        }

    }

    csm_Emissive = ledStripLight;
}`,
    emissive: true,
});
const cube = new THREE.Mesh(geometry, csm);
scene.add(cube);

const gridHelper = new THREE.GridHelper(30, 30);
scene.add(gridHelper);

camera.position.y = 2;
camera.position.z = 5;
camera.lookAt(new THREE.Vector3(0, 0, 0));

const light = new THREE.PointLight(0xffffff, 4);
light.position.set(-1, 5, -1);
scene.add(light);

const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
const lineGeometry = new THREE.BufferGeometry().setFromPoints([LED_STRIPS[0].start, LED_STRIPS[0].end]);
const line = new THREE.Line(lineGeometry, lineMaterial);
scene.add(line);

// show direction of the first LED strip
const directionGeometry = new THREE.BufferGeometry();
const directionMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
const directionStart = LED_STRIPS[0].start.clone().add(LED_STRIPS[0].end.clone().sub(LED_STRIPS[0].start).multiplyScalar(0.5));
const directionEnd = directionStart.clone().add(LED_STRIPS[0].direction.clone().normalize());
directionGeometry.setFromPoints([directionStart, directionEnd]);
const directionLine = new THREE.Line(directionGeometry, directionMaterial);
scene.add(directionLine);

function animate() {
    renderer.render(scene, camera);
    csm.uniforms.uLedStrips.value[0].direction = csm.uniforms.uLedStrips.value[0].direction
        .clone()
        .applyAxisAngle(new THREE.Vector3(0, 0, 1), 0.01);

    const directionStart = LED_STRIPS[0].start.clone().add(LED_STRIPS[0].end.clone().sub(LED_STRIPS[0].start).multiplyScalar(0.5));
    const directionEnd = directionStart.clone().add(LED_STRIPS[0].direction.clone().normalize());
    directionGeometry.setFromPoints([directionStart, directionEnd]);
}
renderer.setAnimationLoop(animate);
