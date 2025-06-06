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
    float attenuation = 2.0 / (1.0 + 1.0 * distanceToStrip + 5.0 * distanceToStrip * distanceToStrip);
    vec3 lightDir = normalize(vWorldPosition - ledStripPoint);
    float surfaceAngle = pow(max(0.0, dot(lightDir, ledStripDirection)), 2.0);
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
            float samplePos = clamp(normalizedPos + float(j) * SAMPLE_DISTANCE, 0.0, 1.0);
            
            int sampleIndex = int(samplePos * 127.0);
            vec3 sampleColor = texelFetch(uLedStripColors, ivec2(sampleIndex, i), 0).rgb;

            vec3 samplePoint = strip.start + dir * (samplePos * stripLength);
            float sampleDist = length(vWorldPosition - samplePoint);
            float sampleIntensity = clamp(intensity(samplePoint, strip.direction) * KERNEL[j + 4], 0.0, 1.0);

            ledStripLight += sampleColor * sampleIntensity;
        }

    }

    csm_Emissive = ledStripLight;
}