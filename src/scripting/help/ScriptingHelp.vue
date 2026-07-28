<template>
    <Dialog v-model:visible="visible" modal header="Scripting guide" :style="{ width: '78vw', maxWidth: '1100px', height: '80vh' }">
        <div class="help">
            <nav class="help__nav">
                <a
                    v-for="section in HELP_SECTIONS"
                    :key="section.id"
                    :href="`#${section.id}`"
                    class="help__nav-link"
                    :class="{ '--active': activeSection === section.id }"
                    @click.prevent="scrollTo(section.id)"
                >
                    {{ section.title }}
                </a>
            </nav>

            <div ref="content" class="help__content">
                <section v-for="section in HELP_SECTIONS" :id="section.id" :key="section.id" class="help__section">
                    <h3>{{ section.title }}</h3>

                    <!-- eslint-disable vue/no-v-html -- formatInline escapes the text before adding markup; see below -->
                    <template v-for="(block, index) in section.blocks" :key="index">
                        <p v-if="block.kind === 'p'" v-html="formatInline(block.text)"></p>

                        <pre v-else-if="block.kind === 'code'" class="help__code"><code>{{ block.text }}</code></pre>

                        <ul v-else-if="block.kind === 'list'">
                            <li v-for="(item, i) in block.items" :key="i" v-html="formatInline(item)"></li>
                        </ul>

                        <div v-else-if="block.kind === 'note'" class="help__note" v-html="formatInline(block.text)"></div>

                        <div v-else-if="block.kind === 'table'" class="help__table-wrapper">
                            <table class="help__table">
                                <thead>
                                    <tr>
                                        <th v-for="header in block.headers" :key="header">{{ header }}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(row, r) in block.rows" :key="r">
                                        <td v-for="(cell, c) in row" :key="c" v-html="formatInline(cell)"></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </template>
                    <!-- eslint-enable vue/no-v-html -->
                </section>
            </div>
        </div>
    </Dialog>
</template>

<script setup lang="ts">
import { nextTick, ref, useTemplateRef, watch } from "vue";
import Dialog from "primevue/dialog";

import { HELP_SECTIONS } from "./helpContent";

const visible = defineModel<boolean>("visible", { required: true });

const content = useTemplateRef<HTMLElement>("content");
const activeSection = ref(HELP_SECTIONS[0].id);

/**
 * Turns the small amount of inline markup the content uses into HTML.
 *
 * Everything is escaped first, so the output is safe to hand to `v-html` even though the source text is full of angle brackets
 * from type names and code snippets.
 */
function formatInline(text: string): string {
    const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    return escaped
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function scrollTo(id: string) {
    content.value?.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    activeSection.value = id;
}

// highlight whichever section is currently in view
let observer: IntersectionObserver | undefined;
watch(visible, async (isVisible) => {
    observer?.disconnect();
    if (!isVisible) {
        return;
    }

    await nextTick();
    if (!content.value) {
        return;
    }

    observer = new IntersectionObserver(
        (entries) => {
            const inView = entries.filter((e) => e.isIntersecting);
            if (inView.length > 0) {
                activeSection.value = inView[0].target.id;
            }
        },
        { root: content.value, rootMargin: "0px 0px -70% 0px" }
    );
    content.value.querySelectorAll(".help__section").forEach((section) => observer!.observe(section));
});
</script>

<style scoped>
.help {
    display: grid;
    grid-template-columns: minmax(150px, 200px) 1fr;
    gap: 1.5rem;
    height: 100%;
    min-height: 0;
}

.help__nav {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    overflow-y: auto;
    border-right: 1px solid var(--p-content-border-color);
    padding-right: 0.5rem;
}

.help__nav-link {
    padding: 0.3rem 0.5rem;
    border-radius: 4px;
    font-size: 0.85rem;
    color: var(--p-text-muted-color);
    text-decoration: none;
    border-left: 2px solid transparent;
}

.help__nav-link:hover {
    background: var(--p-content-hover-background);
    color: var(--p-text-color);
}

.help__nav-link.--active {
    color: var(--p-primary-color);
    border-left-color: var(--p-primary-color);
}

.help__content {
    overflow-y: auto;
    padding-right: 0.5rem;
    line-height: 1.6;
}

.help__section {
    scroll-margin-top: 0.5rem;
    margin-bottom: 2.5rem;
}

.help__section h3 {
    font-size: 1.15rem;
    font-weight: 700;
    margin: 0 0 0.75rem;
    color: var(--p-text-color);
}

.help__section p {
    margin: 0 0 0.75rem;
}

.help__section ul {
    margin: 0 0 0.75rem;
    padding-left: 1.2rem;
    list-style: disc;
}

.help__section li {
    margin-bottom: 0.25rem;
}

.help__code {
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: 6px;
    padding: 0.75rem 0.9rem;
    margin: 0 0 0.9rem;
    overflow-x: auto;
    font-size: 0.82rem;
    line-height: 1.5;
}

.help__note {
    border-left: 3px solid var(--p-primary-color);
    background: var(--p-content-background);
    border-radius: 0 4px 4px 0;
    padding: 0.6rem 0.9rem;
    margin: 0 0 0.9rem;
    font-size: 0.9rem;
}

.help__table-wrapper {
    overflow-x: auto;
    margin: 0 0 0.9rem;
}

.help__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.88rem;
}

.help__table th,
.help__table td {
    text-align: left;
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid var(--p-content-border-color);
    vertical-align: top;
}

.help__table th {
    font-weight: 600;
    color: var(--p-text-muted-color);
    white-space: nowrap;
}

.help :deep(code) {
    background: var(--p-content-border-color);
    border-radius: 3px;
    padding: 0.05rem 0.3rem;
    font-size: 0.85em;
    white-space: nowrap;
}

.help__code :deep(code) {
    background: none;
    padding: 0;
    font-size: inherit;
    white-space: pre;
}
</style>
