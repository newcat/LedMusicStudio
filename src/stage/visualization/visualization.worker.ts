import * as Comlink from "comlink";
import { StageRenderer } from "./stageRenderer";

console.log("Stage visualization worker started");
Comlink.expose(new StageRenderer());
