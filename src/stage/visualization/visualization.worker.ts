import * as Comlink from "comlink";
import { StageRenderer } from "./stageRenderer";

console.log("Hello from worker!");
Comlink.expose(new StageRenderer());
