import * as Comlink from "comlink";
import "../../utils/comlinkVueTransferHandler";
import { StageRenderer } from "./stageRenderer";

console.log("Stage visualization worker started");
Comlink.expose(new StageRenderer());
