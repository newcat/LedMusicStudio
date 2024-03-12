import { Editor, GraphTemplate, IGraphTemplateState } from "baklavajs";

export function useGraphTemplateSync() {
    const token = Symbol("useGraphTemplateSync");
    const targets: Editor[] = [];
    const templates = new Map<string, IGraphTemplateState>();
    let updating = false;

    function registerTarget(target: Editor) {
        targets.push(target);
        target.events.addGraphTemplate.subscribe(token, (template) => {
            updateTemplate(template.save());
        });
        target.events.removeGraphTemplate.subscribe(token, (template) => {
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
            targets.splice(index, 1);

            const target = targets[index];
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

    function updateTemplate(template: IGraphTemplateState) {
        if (updating) {
            return;
        }

        updating = true;
        templates.set(template.id, template);
        for (const target of targets) {
            const targetTemplate = target.graphTemplates.find((t) => t.id === template.id);
            if (targetTemplate) {
                targetTemplate.update(template);
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
        if (updating) {
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

    return { registerTarget, unregisterTarget, save, load };
}
