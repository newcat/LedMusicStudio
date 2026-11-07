<template>
    <div class="camera-menu">
        <Button outlined size="small" icon="mdi mdi-camera" label="Cameras" @click="popover?.toggle($event)" />
        <Popover ref="popover">
            <div class="camera-list">
                <div v-if="store.scene.cameras.length === 0" class="empty">No saved camera positions.</div>
                <div v-for="camera in store.scene.cameras" :key="camera.id" class="camera-row">
                    <Button text size="small" class="name" :label="camera.name" @click="applyCamera(camera)" />
                    <Button
                        text
                        size="small"
                        :icon="camera.isShowDefault ? 'mdi mdi-star' : 'mdi mdi-star-outline'"
                        :title="camera.isShowDefault ? 'Show window default' : 'Use as show window default'"
                        @click="store.setShowDefault(camera.isShowDefault ? null : camera.id)"
                    />
                    <Button text size="small" icon="mdi mdi-pencil" title="Rename" @click="openDialog('rename', camera.id, camera.name)" />
                    <Button text size="small" icon="mdi mdi-delete" title="Delete" @click="store.deleteCameraPosition(camera.id)" />
                </div>
                <Button outlined size="small" icon="mdi mdi-plus" label="Save camera position…" @click="openDialog('save', null, '')" />
            </div>
        </Popover>

        <Dialog v-model:visible="dialogVisible" modal :header="dialogMode === 'save' ? 'Save camera position' : 'Rename camera position'" :style="{ width: '22rem' }">
            <InputText v-model="nameDraft" fluid autofocus placeholder="Name" @keydown.enter="confirmDialog" />
            <template #footer>
                <Button text label="Cancel" @click="dialogVisible = false" />
                <Button label="OK" :disabled="nameDraft.trim().length === 0" @click="confirmDialog" />
            </template>
        </Dialog>
    </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Button from "primevue/button";
import Popover from "primevue/popover";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";

import { useScene } from "../sceneStore";
import type { CameraPose } from "../model/types";
import { emitSceneToast } from "../toastBus";

const props = defineProps<{
    /** Pose of the editor camera, used by "Save camera position…". */
    getPose: () => CameraPose | null;
}>();

const emit = defineEmits<{
    apply: [pose: CameraPose];
}>();

const store = useScene();

const popover = ref<InstanceType<typeof Popover>>();
const dialogVisible = ref(false);
const dialogMode = ref<"save" | "rename">("save");
const dialogCameraId = ref<string | null>(null);
const nameDraft = ref("");

function applyCamera(pose: CameraPose) {
    emit("apply", { position: [...pose.position], target: [...pose.target], fov: pose.fov });
}

function openDialog(mode: "save" | "rename", cameraId: string | null, name: string) {
    dialogMode.value = mode;
    dialogCameraId.value = cameraId;
    nameDraft.value = name;
    dialogVisible.value = true;
}

function confirmDialog() {
    if (nameDraft.value.trim().length === 0) {
        return;
    }
    if (dialogMode.value === "rename" && dialogCameraId.value) {
        store.renameCameraPosition(dialogCameraId.value, nameDraft.value);
    } else {
        const pose = props.getPose();
        if (!pose || !store.saveCameraPosition(nameDraft.value, pose)) {
            emitSceneToast({ severity: "error", summary: "Cannot save camera", detail: "The camera position could not be saved.", life: 4000 });
        }
    }
    dialogVisible.value = false;
}
</script>

<style scoped>
.camera-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 16rem;
}

.camera-row {
    display: flex;
    align-items: center;
}

.camera-row .name {
    flex: 1;
    justify-content: flex-start;
}

.empty {
    opacity: 0.7;
    padding: 0.25rem 0.5rem;
}
</style>
