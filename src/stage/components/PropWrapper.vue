<template>
    <div class="prop" :class="classes" :style="style">
        <template v-for="v in verticalHandles">
            <template v-for="h in horizontalHandles">
                <div class="handle" :class="[v, h]" @pointerdown="onPointerDown($event, v, h)"></div>
            </template>
        </template>
        <div class="handle rotation" @pointerdown="onPointerDownRotation"></div>
        <component :is="propComponent" @pointerdown.native="onPointerDown($event, 'm', 'c')"></component>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { Prop as PropModel, propList } from "../props";

type VerticalHandle = "t" | "m" | "b";
type HorizontalHandle = "l" | "c" | "r";

interface DragData {
    v?: VerticalHandle;
    h?: HorizontalHandle;
    rotation: boolean;
    startX: number;
    startY: number;
}

const props = defineProps({
    selected: { type: Boolean, required: true },
    prop: { type: Object as () => PropModel, required: true },
});

const verticalHandles: VerticalHandle[] = ["t", "m", "b"];
const horizontalHandles: HorizontalHandle[] = ["l", "c", "r"];

const dragData = ref<DragData | null>(null);

const classes = computed(() => {
    return {
        "--selected": props.selected,
    };
});

const style = computed(() => {
    return {
        transform: `translate(${props.prop.x}px, ${props.prop.y}px) rotate(${props.prop.rotation}deg)`,
        width: `${props.prop.width}px`,
        height: `${props.prop.height}px`,
    };
});

const propComponent = computed(() => {
    return propList.find((p) => p.type === props.prop.type)?.component;
});

function onPointerDown(ev: PointerEvent, v: VerticalHandle, h: HorizontalHandle) {
    dragData.value = {
        v,
        h,
        rotation: false,
        startX: ev.screenX,
        startY: ev.screenY,
    };
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
}

function onPointerDownRotation(ev: PointerEvent) {
    dragData.value = {
        rotation: true,
        startX: ev.screenX,
        startY: ev.screenY,
    };
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
}

function onPointerUp() {
    dragData.value = null;
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
}

function onPointerMove(ev: PointerEvent) {
    if (!dragData.value) {
        return;
    }

    const dy = ev.screenY - dragData.value.startY;
    if (dragData.value.v === "t") {
        props.prop.y += dy;
        props.prop.height -= dy;
        dragData.value.startY = ev.screenY;
    } else if (dragData.value.v === "b") {
        props.prop.height += dy;
        dragData.value.startY = ev.screenY;
    }

    const dx = ev.screenX - dragData.value.startX;
    if (dragData.value.h === "l") {
        props.prop.x += dx;
        props.prop.width -= dx;
        dragData.value.startX = ev.screenX;
    } else if (dragData.value.h === "r") {
        props.prop.width += dx;
        dragData.value.startX = ev.screenX;
    }

    if (dragData.value.v === "m" && dragData.value.h === "c") {
        props.prop.x += dx;
        props.prop.y += dy;
        dragData.value.startX = ev.screenX;
        dragData.value.startY = ev.screenY;
    }

    if (dragData.value.rotation) {
        props.prop.rotation += dx;
        dragData.value.startX = ev.screenX;
        dragData.value.startY = ev.screenY;
    }
}
</script>

<style lang="scss" scoped>
.prop {
    $color-primary: #1eb980;

    position: relative;
    border-width: 2px;
    border-style: solid;
    border-color: transparent;

    transition: border-color 0.3s linear;

    &:hover:not(.--selected) {
        border-color: scale-color($color-primary, $alpha: -50%);
    }

    &.--selected {
        border-color: $color-primary;
    }

    .handle {
        position: absolute;
        width: 10px;
        height: 10px;
        transform: translate(-50%, -50%);
        opacity: 0;
        background-color: $color-primary;

        transition: opacity 0.3s linear, background-color 0.1s linear;

        &:hover {
            background-color: lighten($color-primary, 10%);
        }

        &.t {
            top: 0;
        }

        &.m {
            top: 50%;
        }

        &.b {
            top: 100%;
        }

        &.l {
            left: 0;
        }

        &.c {
            left: 50%;
        }

        &.r {
            left: 100%;
        }

        &.rotation {
            top: -30px;
            left: 50%;
        }
    }

    &.--selected .handle {
        display: block;
        opacity: 1;
    }
}
</style>
