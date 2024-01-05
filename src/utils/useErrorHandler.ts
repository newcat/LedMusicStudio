import { useToast } from "primevue/usetoast";

export function useErrorHandler() {
    const toast = useToast();

    async function errorHandler<T>(summary: string, fn: () => T | Promise<T>) {
        try {
            return await fn();
        } catch (err) {
            console.error(err);
            toast.add({
                severity: "warn",
                closable: true,
                summary: summary,
                detail: err instanceof Error ? err.message : String(err),
                life: 4000,
            });
        }
    }

    return errorHandler;
}
