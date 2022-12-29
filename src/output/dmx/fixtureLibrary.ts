import { ref } from "vue";
import { useLocalStorage } from "@vueuse/core";
import { defineStore } from "pinia";
import { loadAsync } from "jszip";
import axios from "axios";
import { Fixture } from "./open-fixture";

export const useFixtureLibrary = defineStore("fixtureLibrary", () => {
    const fixtures = useLocalStorage<Fixture[]>("fixtureLibrary", []);
    const updating = ref(false);

    async function updateFixtures() {
        const response = await axios.get("https://open-fixture-library.org/download.ofl", {
            responseType: "blob",
        });
        const zip = await loadAsync(response.data);

        const updatedFixtures: Fixture[] = [];
        for (const file of Object.values(zip.files)) {
            if (file.dir) {
                continue;
            }

            const fixture = JSON.parse(await file.async("string"));
            updatedFixtures.push(fixture);
        }

        fixtures.value = updatedFixtures;
    }

    return { fixtures, updating, updateFixtures };
});
