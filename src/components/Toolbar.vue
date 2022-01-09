<template lang="pug">
v-toolbar(dense)
    v-toolbar-items
        v-menu(v-for="i in items", :key="i.name", offset-y)
            template(v-slot:activator="{ on }")
                v-btn(text, v-on="on")
                    | {{ i.name }}
                    v-icon arrow_drop_down
            v-list
                v-list-item(v-for="c in i.children", :key="c.name", @click="$emit(c.event)")
                    v-list-item-title {{ c.name }}
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";

@Component
export default class Toolbar extends Vue {
    items = [
        {
            name: "File",
            children: [
                { name: "New", event: "newProject" },
                { name: "Open", event: "load" },
                { name: "Save", event: "save" },
                { name: "Save as", event: "saveAs" },
            ],
        },
        {
            name: "Edit",
            children: [{ name: "Settings", event: "showSettings" }],
        },
    ];
}
</script>
