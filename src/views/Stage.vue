<template>
    <Card class="h-full" :pt="{ body: { class: 'p-0 h-full' }, content: { class: 'p-0 h-full' } }">
        <template #content>
            <div class="flex flex-col h-full">
                <div><TabMenu v-model:active-index="selectedTab" :model="menuItems" /></div>

                <div class="content">
                    <Fixtures v-if="selectedTab === 0" />
                    <Controllers v-else-if="selectedTab === 1" />
                    <Visualization v-else-if="selectedTab === 2" />
                </div>
            </div>
        </template>
    </Card>
</template>

<script setup lang="ts">
import { ref } from "vue";
import TabMenu, { TabMenuProps } from "primevue/tabmenu";
import Card from "primevue/card";

import Fixtures from "@/stage/components/Fixtures.vue";
import Controllers from "@/stage/components/Controllers.vue";
import Visualization from "@/stage/components/Visualization.vue";

const selectedTab = ref(0);

const menuItems: TabMenuProps["model"] = [
    { label: "Fixtures", icon: "mdi mdi-lamp" },
    { label: "Controllers", icon: "mdi mdi-chip" },
    { label: "Visualization", icon: "mdi mdi-eye" },
];
</script>

<style scoped>
.content {
    margin: 1rem;
    display: flex;
    height: 100%;
    width: calc(100% - 2rem);
}
</style>