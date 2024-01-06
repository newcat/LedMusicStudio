import { Editor } from "@baklavajs/core";

import * as InputNodes from "./input";
import * as ColorNodes from "./colors";
import * as ConverterNodes from "./converters";
import * as LogicNodes from "./logic";
import * as GeneratorNodes from "./generators";
import * as EffectNodes from "./effects";
import * as OutputNodes from "./output";
import ScriptNode from "./scriptNode";

function registerCategory(editor: Editor, nodes: any, category?: string) {
    for (const k of Object.keys(nodes)) {
        editor.registerNodeType(nodes[k], { category });
    }
}

export function registerNodes(editor: Editor) {
    registerCategory(editor, InputNodes, "Input");
    registerCategory(editor, ColorNodes, "Colors");
    registerCategory(editor, ConverterNodes, "Converters");
    registerCategory(editor, LogicNodes, "Logic");
    registerCategory(editor, GeneratorNodes, "Generators");
    registerCategory(editor, EffectNodes, "Effects");
    registerCategory(editor, OutputNodes, "Outputs");

    editor.registerNodeType(ScriptNode);
}
