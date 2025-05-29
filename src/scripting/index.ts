import { LMSApiImpl } from "./api/lms.api";

export * from "./script.libraryItem";
export { default as ScriptEditor } from "./ScriptEditor.vue";

(self as any).lmsApi = new LMSApiImpl();
