<template>
    <div class="clip-inspector">
        <div class="__group">
            <span class="__count">{{ items.length }} clip{{ items.length === 1 ? "" : "s" }}</span>
            <span class="__source" :title="sourceText">{{ sourceText }}</span>
            <Button
                v-if="singleSource"
                v-tooltip.top="'Open in editor'"
                text
                size="small"
                icon="mdi mdi-open-in-app"
                @click="library.selectedItemId = singleSource.id"
            />
        </div>

        <div v-if="targetable.length > 0" class="__group">
            <label>Target</label>
            <div class="__target">
                <TargetSelect :model-value="targetValue" :mixed="targetMixed" allow-inherit @update:model-value="setTarget" />
            </div>
        </div>

        <div class="__group">
            <label for="clip-start">Start</label>
            <InputText
                id="clip-start"
                v-model="drafts.start"
                size="small"
                class="__input"
                :placeholder="startText === null ? 'Mixed' : ''"
                @keydown.enter="($event.target as HTMLInputElement).blur()"
                @blur="commitStart"
            />
        </div>

        <div v-if="!hasAudio" class="__group">
            <label for="clip-length">Length</label>
            <InputText
                id="clip-length"
                v-model="drafts.length"
                size="small"
                class="__input"
                :placeholder="lengthText === null ? 'Mixed' : ''"
                @keydown.enter="($event.target as HTMLInputElement).blur()"
                @blur="commitLength"
            />
            <span class="__unit">beats</span>
        </div>

        <template v-if="allFades">
            <div class="__group">
                <label for="clip-fade-in">Fade in</label>
                <InputText
                    id="clip-fade-in"
                    v-model="drafts.fadeIn"
                    size="small"
                    class="__input"
                    :placeholder="fadeInText === null ? 'Mixed' : ''"
                    @keydown.enter="($event.target as HTMLInputElement).blur()"
                    @blur="commitFade('in')"
                />
            </div>
            <div class="__group">
                <label for="clip-fade-out">Fade out</label>
                <InputText
                    id="clip-fade-out"
                    v-model="drafts.fadeOut"
                    size="small"
                    class="__input"
                    :placeholder="fadeOutText === null ? 'Mixed' : ''"
                    @keydown.enter="($event.target as HTMLInputElement).blur()"
                    @blur="commitFade('out')"
                />
                <span class="__unit">beats</span>
            </div>
        </template>

        <div class="__spacer"></div>

        <Button v-if="items.some(canMakeUnique)" text size="small" icon="mdi mdi-link-variant-off" label="Make unique" @click="makeUnique" />
        <Button text size="small" severity="danger" icon="mdi mdi-delete" label="Delete" @click="timeline.deleteSelection()" />
    </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import Button from "primevue/button";
import InputText from "primevue/inputtext";

import { useLibrary } from "@/library";
import TargetSelect, { type TargetSelectValue } from "@/programming/components/TargetSelect.vue";
import { clampFades } from "@/programming/effects";
import { LibraryItemType } from "@/library";
import { canMakeUnique, FADE_TYPES, TARGET_TYPES, useTimeline } from "../model/editor";
import { cloneClipTarget, type ClipTarget, type Item } from "../model/item";
import { allowedDelta, clampResize, type Span } from "../model/placement";
import { formatBarBeatTick, formatBeats, parseBarBeatTick, parseBeats } from "../timeFormat";

/** Clip inspector strip (feature 005, R13): multi-edit of the selected clips; every commit is one undo step. */

const timeline = useTimeline();
const library = useLibrary();

const items = computed(() => timeline.selectedItems);

// --- source ------------------------------------------------------------------------------------------------------

const sources = computed(() => Array.from(new Set(items.value.map((i) => i.libraryItem))));
const singleSource = computed(() => (sources.value.length === 1 ? sources.value[0] : null));
const sourceText = computed(() => (singleSource.value ? singleSource.value.name : `${sources.value.length} items`));

// --- target ------------------------------------------------------------------------------------------------------

const targetable = computed(() => items.value.filter((i) => TARGET_TYPES.includes(i.libraryItem.type)));
const targetKey = (t: ClipTarget) => (t === "inherit" ? "inherit" : t ? `${t.kind}:${t.id}` : "");
const targetMixed = computed(() => new Set(targetable.value.map((i) => targetKey(i.target))).size > 1);
const targetValue = computed<TargetSelectValue>(() => targetable.value[0]?.target ?? null);

function setTarget(value: TargetSelectValue) {
    if (value === "clip") {
        return;
    }
    const list = targetable.value;
    timeline.edit("Target", () => {
        list.forEach((i) => (i.target = cloneClipTarget(value)));
    });
}

// --- start, length, fades ----------------------------------------------------------------------------------------

const hasAudio = computed(() => items.value.some((i) => i.libraryItem.type === LibraryItemType.AUDIO));
const allFades = computed(() => items.value.length > 0 && items.value.every((i) => FADE_TYPES.includes(i.libraryItem.type)));

/** The common formatted value, or null when the clips differ. */
function common(fn: (i: Item) => string): string | null {
    const values = new Set(items.value.map(fn));
    return values.size === 1 ? values.values().next().value! : null;
}

const startText = computed(() => common((i) => formatBarBeatTick(i.start)));
const lengthText = computed(() => common((i) => formatBeats(i.end - i.start)));
const fadeInText = computed(() => common((i) => formatBeats(clampFades(i.end - i.start, i.fadeIn, i.fadeOut)[0])));
const fadeOutText = computed(() => common((i) => formatBeats(clampFades(i.end - i.start, i.fadeIn, i.fadeOut)[1])));

const drafts = reactive({ start: "", length: "", fadeIn: "", fadeOut: "" });

function resetDrafts() {
    drafts.start = startText.value ?? "";
    drafts.length = lengthText.value ?? "";
    drafts.fadeIn = fadeInText.value ?? "";
    drafts.fadeOut = fadeOutText.value ?? "";
}
watch([startText, lengthText, fadeInText, fadeOutText], resetDrafts, { immediate: true });

function trackIndexOf(trackId: string) {
    return timeline.tracks.findIndex((t) => t.id === trackId);
}

function spanOf(i: Item): Span {
    return { id: i.id, start: i.start, end: i.end, trackIndex: trackIndexOf(i.trackId) };
}

function staticsExcept(id: string): Span[] {
    return timeline.items.filter((i) => i.id !== id).map(spanOf);
}

function commitStart() {
    const value = drafts.start.trim() === "" ? null : parseBarBeatTick(drafts.start);
    if (value === null || drafts.start === (startText.value ?? "")) {
        resetDrafts();
        return;
    }
    const list = items.value.slice();
    timeline.edit("Start", () => {
        for (const i of list) {
            const d = allowedDelta([spanOf(i)], staticsExcept(i.id), value - i.start);
            if (d !== null && d !== 0) {
                i.move(i.start + d, i.end + d);
            }
        }
    });
    resetDrafts();
}

function commitLength() {
    const value = drafts.length.trim() === "" ? null : parseBeats(drafts.length);
    if (value === null || value <= 0 || drafts.length === (lengthText.value ?? "")) {
        resetDrafts();
        return;
    }
    const list = items.value.filter((i) => i.resizable);
    timeline.edit("Length", () => {
        for (const i of list) {
            const end = clampResize(spanOf(i), "end", i.start + value, staticsExcept(i.id));
            if (end !== i.end) {
                i.move(i.start, end);
            }
        }
    });
    resetDrafts();
}

function commitFade(which: "in" | "out") {
    const text = which === "in" ? drafts.fadeIn : drafts.fadeOut;
    const current = which === "in" ? fadeInText.value : fadeOutText.value;
    const value = text.trim() === "" ? null : parseBeats(text);
    if (value === null || text === (current ?? "")) {
        resetDrafts();
        return;
    }
    const list = items.value.slice();
    timeline.edit(which === "in" ? "Fade in" : "Fade out", () => {
        for (const i of list) {
            const length = i.end - i.start;
            const [fi, fo] = clampFades(length, i.fadeIn, i.fadeOut);
            if (which === "in") {
                i.fadeIn = Math.min(value, Math.max(0, length - fo));
                i.fadeOut = fo;
            } else {
                i.fadeIn = fi;
                i.fadeOut = Math.min(value, Math.max(0, length - fi));
            }
        }
    });
    resetDrafts();
}

function makeUnique() {
    void timeline.makeUnique(items.value.slice());
}
</script>

<style scoped>
.clip-inspector {
    display: flex;
    align-items: center;
    gap: 0.4rem 0.9rem;
    padding: 0.35rem 1rem;
    background-color: var(--p-menubar-background);
    border-top: 1px solid var(--p-menubar-border-color);
    font-size: 0.85rem;
    flex-wrap: wrap;
}

.__group {
    display: flex;
    align-items: center;
    gap: 0.4rem;
}

.__group label {
    opacity: 0.75;
}

.__count {
    font-weight: 600;
}

.__source {
    max-width: 12rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.__target {
    width: 11rem;
}

.__input {
    width: 4.5rem;
}

.__unit {
    opacity: 0.6;
}

.__spacer {
    flex-grow: 1;
}
</style>
