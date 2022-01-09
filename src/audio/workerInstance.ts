import * as Comlink from "comlink";
import { WaveformWorker as WaveformWorkerType } from "./waveformWorker";
import WaveformWorker from "./waveformWorker?worker";

const instance = Comlink.wrap<WaveformWorkerType>(new WaveformWorker());
export default instance;
