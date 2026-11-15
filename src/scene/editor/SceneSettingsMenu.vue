<template>
    <div class="scene-settings-menu">
        <Button text severity="secondary" size="small" icon="mdi mdi-image-filter-hdr" label="Scene settings" @click="popover?.toggle($event)" />
        <Popover ref="popover">
            <Tabs value="environment">
                <TabList>
                    <Tab value="environment"><i class="mdi mdi-weather-fog tab-icon" /> Environment</Tab>
                    <Tab value="display"><i class="mdi mdi-monitor tab-icon" /> Display</Tab>
                </TabList>
                <TabPanels>
                    <TabPanel value="environment">
                        <EnvironmentPanel />
                    </TabPanel>
                    <TabPanel value="display">
                        <DisplayPanel />
                    </TabPanel>
                </TabPanels>
            </Tabs>
        </Popover>
    </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Button from "primevue/button";
import Popover from "primevue/popover";
import Tabs from "primevue/tabs";
import TabList from "primevue/tablist";
import Tab from "primevue/tab";
import TabPanels from "primevue/tabpanels";
import TabPanel from "primevue/tabpanel";

import EnvironmentPanel from "./EnvironmentPanel.vue";
import DisplayPanel from "./DisplayPanel.vue";

const popover = ref<InstanceType<typeof Popover>>();
</script>

<style scoped>
.scene-settings-menu {
    display: inline-flex;
}

.tab-icon {
    margin-right: 0.375rem;
}
</style>
