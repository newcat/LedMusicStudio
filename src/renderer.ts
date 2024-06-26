import { pack } from "msgpackr";
import { gzipSync } from "fflate";
// @ts-expect-error lamejs package does not have types
import { Mp3Encoder } from "lamejs";
import { BaklavaEvent } from "@baklavajs/events";

import { RenderedFile } from "lms_bridge/RenderedFile";
import { WsMessage } from "lms_bridge/WsMessage";

import { useBridge } from "./bridge";
import { useGlobalState } from "./globalState";
import { useStage } from "./stage";
import { BaseTimelineProcessor } from "./timeline";
import { unitToSeconds } from "./utils";
import { LibraryItemType } from "./library";
import { AudioLibraryItem } from "./audio";
import { TICKS_PER_BEAT } from "./constants";

// https://github.com/zhuker/lamejs/issues/86
// @ts-expect-error lamejs package does not have types
import MPEGMode from "lamejs/src/js/MPEGMode";
// @ts-expect-error lamejs package does not have types
import Lame from "lamejs/src/js/Lame";
// @ts-expect-error lamejs package does not have types
import BitStream from "lamejs/src/js/BitStream";

(window as any).MPEGMode = MPEGMode;
(window as any).Lame = Lame;
(window as any).BitStream = BitStream;

export class Renderer {
    public readonly events = {
        stepChanged: new BaklavaEvent<string, undefined>(undefined),
        progress: new BaklavaEvent<number, undefined>(undefined),
    };

    private readonly globalState = useGlobalState();
    private readonly stage = useStage();
    private readonly bridge = useBridge();

    private cancelRequest = false;

    public async startRender(): Promise<Uint8Array | null> {
        const maxUnit = this.globalState.timeline.items.reduce((max, item) => Math.max(max, item.end), 0);
        const processor = new BaseTimelineProcessor();
        let nextFrameTime = 0;
        const timestamps: number[] = [];
        const commands: WsMessage[][] = [];

        this.stage.visualization.pause();

        this.events.progress.emit(0);
        this.events.stepChanged.emit("Rendering project");
        for (let unit = 0; unit <= maxUnit; unit++) {
            if (this.cancelRequest) {
                break;
            }
            await processor.process(unit);

            const secondsPerFrame = 1 / this.globalState.fps;
            const nextTimestamp = unitToSeconds(unit + 1, this.globalState.bpm);
            if (nextTimestamp > nextFrameTime) {
                timestamps.push(nextFrameTime);
                nextFrameTime += secondsPerFrame;
                const commandsForFrame: WsMessage[] = [];
                for (const [id, controller] of this.bridge.controllers) {
                    const msg = controller.getValueMessage();
                    if (msg) {
                        commandsForFrame.push({
                            type: "CallController",
                            id,
                            message: JSON.stringify(msg),
                        });
                    }
                }
                commands.push(commandsForFrame);
            }

            this.events.progress.emit(Math.floor((unit / maxUnit) * 100));
            if (unit % TICKS_PER_BEAT === 0) {
                await new Promise((res) => setTimeout(res, 0));
            }
        }

        this.events.progress.emit(100);

        if (this.cancelRequest) {
            this.cancelRequest = false;
            return null;
        }

        const audio = await this.renderAudio(maxUnit);

        if (this.cancelRequest) {
            this.cancelRequest = false;
            return null;
        }

        const controllers: WsMessage[] = [];
        for (const [id, controller] of this.bridge.controllers) {
            controllers.push({
                type: "AddController",
                controller_type: controller.type,
                id,
            });
            const configMsg = controller.getConfigurationMessage();
            if (configMsg) {
                controllers.push({
                    type: "CallController",
                    id,
                    message: JSON.stringify(configMsg),
                });
            }
        }

        const result: RenderedFile = {
            audio,
            controllers,
            timestamps,
            commands,
        };

        return gzipSync(pack(result));
    }

    public cancelRender() {
        this.cancelRequest = true;
    }

    private async renderAudio(maxUnit: number) {
        this.events.stepChanged.emit("Rendering audio");
        this.events.progress.emit(-1);

        const SAMPLE_RATE = 44100;
        const length = unitToSeconds(maxUnit, this.globalState.bpm) * SAMPLE_RATE;
        const ctx = new OfflineAudioContext({
            length,
            sampleRate: SAMPLE_RATE,
            numberOfChannels: 2,
        });
        for (const item of this.globalState.timeline.items) {
            if (item.libraryItem.type !== LibraryItemType.AUDIO) {
                continue;
            }

            const source = ctx.createBufferSource();
            source.buffer = (item.libraryItem as AudioLibraryItem).audioBuffer;
            source.connect(ctx.destination);
            const startTime = unitToSeconds(item.start, this.globalState.bpm);
            if (startTime > 0) {
                source.start(startTime);
            } else {
                source.start(0, -startTime);
            }
        }

        const buffer = await ctx.startRendering();

        this.events.stepChanged.emit("Encoding audio");
        this.events.progress.emit(0);

        //stereo, 44.1 kHz, encode to 256 kBps
        const encoder = new Mp3Encoder(2, 44100, 256);
        //can be anything but make it a multiple of 576 to make encoders life easier
        const sampleBlockSize = 10 * 576;

        const mp3Data: number[] = [];
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);
        for (let i = 0; i < left.length; i += sampleBlockSize) {
            if (this.cancelRequest) {
                break;
            }

            const leftChunk = new Int16Array(left.subarray(i, i + sampleBlockSize).map((v) => v * 32767));
            const rightChunk = new Int16Array(right.subarray(i, i + sampleBlockSize).map((v) => v * 32767));
            const mp3buf: Int8Array = encoder.encodeBuffer(leftChunk, rightChunk);
            if (mp3buf.length > 0) {
                mp3Data.push(...mp3buf);
            }

            this.events.progress.emit(Math.floor((i / left.length) * 100));
            await new Promise((res) => setTimeout(res, 0));
        }

        if (this.cancelRequest) {
            return new Int8Array();
        }

        const mp3buf: Int8Array = encoder.flush();
        if (mp3buf.length > 0) {
            mp3Data.push(...mp3buf);
        }

        return new Int8Array(mp3Data);
    }
}
