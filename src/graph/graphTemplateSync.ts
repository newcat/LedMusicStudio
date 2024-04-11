import { ref } from "vue";
import { Editor, GraphTemplate, IGraphTemplateState } from "baklavajs";

export function useGraphTemplateSync() {
    const token = Symbol("useGraphTemplateSync");
    const targets: Editor[] = [];
    const templates = new Map<string, IGraphTemplateState>();
    const skipSync = ref(false);
    let updating = false;

    function registerTarget(target: Editor) {
        targets.push(target);
        target.events.addGraphTemplate.subscribe(token, (template) => {
            updateTemplate(template.save());
        });
        target.events.removeGraphTemplate.subscribe(token, (template) => {
            if (target.loading) {
                return;
            }
            removeTemplate(template.id);
        });
        target.graphTemplateEvents.updated.subscribe(token, (_, template) => {
            updateTemplate(template.save());
        });
        target.graphTemplateEvents.nameChanged.subscribe(token, (_, template) => {
            updateTemplate(template.save());
        });
        for (const template of templates.values()) {
            if (target.graphTemplates.find((t) => t.id === template.id)) {
                continue;
            }

            const newTemplate = new GraphTemplate(template, target);
            newTemplate.id = template.id;
            target.addGraphTemplate(newTemplate);
        }
    }

    function unregisterTarget(target: Editor) {
        const index = targets.indexOf(target);
        if (index !== -1) {
            const target = targets[index];
            targets.splice(index, 1);

            target.events.addGraphTemplate.unsubscribe(token);
            target.events.removeGraphTemplate.unsubscribe(token);
            target.graphTemplateEvents.updated.unsubscribe(token);
            target.graphTemplateEvents.nameChanged.unsubscribe(token);
        }
    }

    function save() {
        return Array.from(templates.values());
    }

    function load(state: IGraphTemplateState[]) {
        for (const template of state) {
            updateTemplate(template);
        }
    }

    function reset() {
        templates.clear();
        while (targets.length > 0) {
            unregisterTarget(targets[0]);
        }
        updating = false;
        skipSync.value = false;
    }

    function updateTemplate(template: IGraphTemplateState) {
        if (updating || skipSync.value) {
            return;
        }

        updating = true;
        templates.set(template.id, template);
        for (const target of targets) {
            const targetTemplate = target.graphTemplates.find((t) => t.id === template.id);
            if (targetTemplate) {
                targetTemplate.update({
                    ...template,
                    panning: template.panning ?? { x: 0, y: 0 },
                    scaling: template.scaling ?? 1,
                });
                targetTemplate.name = template.name;
            } else {
                const newTemplate = new GraphTemplate(template, target);
                newTemplate.id = template.id;
                target.addGraphTemplate(newTemplate);
            }
        }
        updating = false;
    }

    function removeTemplate(id: string) {
        if (updating || skipSync.value) {
            return;
        }

        updating = true;
        templates.delete(id);
        for (const target of targets) {
            const targetTemplate = target.graphTemplates.find((t) => t.id === id);
            if (targetTemplate) {
                target.removeGraphTemplate(targetTemplate);
            }
        }
        updating = false;
    }

    return { skipSync, registerTarget, unregisterTarget, save, load, reset };
}
