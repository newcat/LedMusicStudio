import Ajv from "ajv";

import capability from "./fixture-schemas/capability.json";
import channel from "./fixture-schemas/channel.json";
import definitions from "./fixture-schemas/definitions.json";
import fixture from "./fixture-schemas/fixture.json";
import gobo from "./fixture-schemas/gobo.json";
import matrix from "./fixture-schemas/matrix.json";
import plugin from "./fixture-schemas/plugin.json";
import wheelSlot from "./fixture-schemas/wheel-slot.json";

const ajv = new Ajv({ allErrors: true, strict: false, removeAdditional: true, discriminator: true, validateFormats: false });
const validate = ajv.addSchema([capability, channel, definitions, fixture, gobo, matrix, plugin, wheelSlot]).compile(fixture);

export function validateFixture(fixture: unknown): string[] {
    const validationResult = validate(fixture);
    if (!validationResult) {
        console.error(validate.errors);
        return validate.errors?.map((e) => e.message ?? "Unknown error") ?? ["Unknown error"];
    }
    return [];
}
