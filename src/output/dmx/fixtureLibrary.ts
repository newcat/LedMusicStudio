import { ref } from "vue";
import { useLocalStorage } from "@vueuse/core";
import { defineStore } from "pinia";
import { loadAsync } from "jszip";
import axios from "axios";
import { Fixture, OFLManufacturers } from "./open-fixture";

export interface Manufacturer {
    name: string;
    fixtures: Fixture[];
}

export const useFixtureLibrary = defineStore("fixtureLibrary", () => {
    const fixtures = useLocalStorage<Manufacturer[]>("fixtureLibrary", []);
    const updating = ref(false);

    async function updateFixtures() {
        const response = await axios.get("https://open-fixture-library.org/download.ofl", {
            responseType: "blob",
        });
        const zip = await loadAsync(response.data);

        const manufacturerFile = zip.file("manufacturers.json");
        if (!manufacturerFile) {
            throw new Error("Invalid file format - could not find manufacturers.json");
        }

        const updatedFixtures: Manufacturer[] = [];
        const manufacturers: OFLManufacturers = JSON.parse(await manufacturerFile.async("string"));
        for (const [k, v] of Object.entries(manufacturers)) {
            if (k === "$schema") {
                continue;
            }

            const fixturesOfManufacturer: Fixture[] = [];
            for (const file of zip.file(RegExp(`${k}/.*\\.json$`))) {
                if (file.dir) {
                    continue;
                }
                const fixture = JSON.parse(await file.async("string"));
                fixturesOfManufacturer.push(fixture);
            }

            updatedFixtures.push({
                name: v.name,
                fixtures: fixturesOfManufacturer,
            });
        }

        fixtures.value = updatedFixtures;
    }

    return { fixtures, updating, updateFixtures };
});
