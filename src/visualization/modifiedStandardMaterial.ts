import * as THREE from "three";
import CustomShaderMaterial from "three-custom-shader-material/vanilla";
import { ledStripInstanceManager } from "./fixtureVisualizations/ledStrip/ledStrip.renderer";
import fragmentShader from "./shaders/modifiedStandardMaterial.frag?raw";
import vertexShader from "./shaders/modifiedStandardMaterial.vert?raw";

export const ModifiedStandardMaterial = new CustomShaderMaterial<typeof THREE.MeshPhysicalMaterial>({
    baseMaterial: THREE.MeshPhysicalMaterial,
    uniforms: ledStripInstanceManager.getUniforms(),
    vertexShader,
    fragmentShader,
});

export function updateModifiedStandardMaterial() {
    const newUniforms = ledStripInstanceManager.getUniforms();
    ModifiedStandardMaterial.uniforms.uNumLedStrips.value = newUniforms.uNumLedStrips.value;
    ModifiedStandardMaterial.uniforms.uLedStrips.value = newUniforms.uLedStrips.value;
}
