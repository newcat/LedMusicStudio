<template>
    <div class="asset-grid">
        <IconField class="search">
            <InputIcon class="pi pi-search" />
            <InputText
                v-model="query"
                size="small"
                placeholder="Search assets"
                aria-label="Search assets"
                fluid
                @keydown.esc.stop.prevent="query = ''"
            />
            <InputIcon v-if="query" class="pi pi-times clear" role="button" aria-label="Clear search" @click="query = ''" />
        </IconField>

        <div class="sections">
            <div v-if="searching && sections.length === 0" class="empty">No assets match "{{ query.trim() }}"</div>
            <section v-for="section in sections" :key="section.category" class="section">
                <button
                    v-if="collapsible"
                    type="button"
                    class="section-header"
                    :aria-expanded="isOpen(section.category)"
                    @click="toggle(section.category)"
                >
                    <i class="pi" :class="isOpen(section.category) ? 'pi-chevron-down' : 'pi-chevron-right'"></i>
                    <span>{{ CATEGORY_LABELS[section.category] }}</span>
                    <span class="count">{{ section.assets.length }}</span>
                </button>
                <div v-else class="section-header static">
                    <span>{{ CATEGORY_LABELS[section.category] }}</span>
                </div>
                <div v-if="!collapsible || isOpen(section.category)" class="tiles">
                    <AssetTile
                        v-for="asset in section.assets"
                        :key="asset.id"
                        :asset="asset"
                        :draggable="draggable"
                        :selected="asset.id === selectedId"
                        @activate="emit('activate', $event)"
                        @select="emit('select', $event)"
                    />
                </div>
            </section>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";
import InputText from "primevue/inputtext";

import { assetCatalog } from "@/assetLibrary/catalog";
import type { AssetCategory, AssetDefinition } from "@/assetLibrary/types";
import AssetTile from "./AssetTile.vue";

const props = withDefaults(
    defineProps<{
        /** Categories to show; all when omitted. */
        categories?: AssetCategory[];
        collapsible?: boolean;
        /** Open/closed state per category (collapsible grids); mutated when a section is toggled. */
        openState?: Partial<Record<AssetCategory, boolean>>;
        draggable?: boolean;
        selectedId?: string | null;
    }>(),
    { categories: undefined, collapsible: false, openState: undefined, draggable: true, selectedId: null }
);

const emit = defineEmits<{
    activate: [assetId: string];
    select: [assetId: string];
}>();

const CATEGORY_ORDER: AssetCategory[] = ["fixtures", "stage", "decoration", "shapes"];
const CATEGORY_LABELS: Record<AssetCategory, string> = {
    fixtures: "Fixtures",
    stage: "Stage",
    decoration: "Decoration",
    shapes: "Basic shapes",
};

const query = ref("");
const searching = computed(() => query.value.trim().length > 0);

const sections = computed(() => {
    const allowed = props.categories ?? CATEGORY_ORDER;
    const assets: readonly AssetDefinition[] = searching.value ? assetCatalog.search(query.value) : assetCatalog.all();
    return CATEGORY_ORDER.filter((category) => allowed.includes(category))
        .map((category) => ({ category, assets: assets.filter((a) => a.category === category) }))
        .filter((section) => section.assets.length > 0);
});

/** Sections with hits are expanded while a search is active. */
function isOpen(category: AssetCategory): boolean {
    return searching.value || (props.openState?.[category] ?? true);
}

function toggle(category: AssetCategory) {
    if (searching.value || !props.openState) {
        return;
    }
    // eslint-disable-next-line vue/no-mutating-props -- the open state is a shared session object owned by the caller
    props.openState[category] = !isOpen(category);
}
</script>

<style scoped>
.asset-grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-height: 0;
    height: 100%;
}

.search {
    flex: none;
}

.clear {
    cursor: pointer;
}

.sections {
    flex: 1;
    min-height: 0;
    overflow: auto;
    /* keep the scrollbar off the tiles and section counts */
    scrollbar-gutter: stable;
    padding-right: 0.25rem;
}

.empty {
    opacity: 0.7;
    font-size: 0.85rem;
    padding: 0.5rem 0.25rem;
}

.section + .section {
    margin-top: 0.5rem;
}

.section-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    width: 100%;
    padding: 0.375rem 0.25rem;
    background: none;
    border: none;
    color: var(--p-text-muted-color);
    font: inherit;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    cursor: pointer;
    text-align: left;
}

.section-header:hover {
    color: var(--p-text-color);
}

.section-header.static {
    cursor: default;
}

.section-header .pi {
    font-size: 0.7rem;
}

.count {
    margin-left: auto;
    opacity: 0.5;
    font-weight: normal;
    font-size: 0.75rem;
}

.tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: 0.75rem 0.5rem;
    padding: 0.25rem 0.25rem 0.5rem;
}
</style>
