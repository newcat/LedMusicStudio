/**
 * Editor helpers (feature 004): the fixtures an editor shows slot names and previews for, i.e. the target of the
 * selected timeline item that uses the library item (else its first timeline item), and the scene's aim targets.
 */

import { computed, type ComputedRef } from "vue";
import type { LibraryItem } from "@/library/libraryItem";
import { useScene } from "@/scene/sceneStore";
import { isAimTarget } from "@/scene/model/types";
import { useTimeline } from "@/timeline/model/editor";
import { BUILT_IN_DEFAULTS, cloneValue, type AttributeKey, type AttributeValue } from "./attributes";
import { dmxFixtures, getProfile, profileOptions } from "./profile";
import { resolveTarget } from "./targets";
import type { ResolvedFixture } from "./types";

export function useItemTargetFixtures(libraryItem: () => LibraryItem): ComputedRef<ResolvedFixture[]> {
    const timeline = useTimeline();
    return computed(() => {
        const item = libraryItem();
        const items = timeline.items.filter((i) => i.libraryItem.id === item.id);
        const chosen = items.find((i) => i.selected) ?? items[0];
        return chosen ? resolveTarget(chosen.target).fixtures : [];
    });
}

/** Profiles for slot names: the given fixtures, or every DMX fixture if none. */
export function editorProfiles(fixtureIds: string[]) {
    return profileOptions(fixtureIds.length > 0 ? fixtureIds : dmxFixtures().map((f) => f.id));
}

/** Initial value of a newly added attribute: the first fixture's default, else the built-in default. */
export function initialAttributeValue(key: AttributeKey, fixtureIds: string[]): AttributeValue {
    const profile = fixtureIds.length > 0 ? getProfile(fixtureIds[0]) : null;
    return cloneValue(key, (profile?.defaults ?? BUILT_IN_DEFAULTS)[key]);
}

export function useAimTargets() {
    const scene = useScene();
    return computed(() =>
        Object.values(scene.scene.objects)
            .filter(isAimTarget)
            .map((o) => ({ label: o.name, value: o.id }))
            .sort((a, b) => a.label.localeCompare(b.label))
    );
}
