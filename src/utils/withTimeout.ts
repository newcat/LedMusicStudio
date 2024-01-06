export async function withTimeout<T>(cb: () => Promise<T>, errorMessage: string = "Timeout while performing operation"): Promise<T> {
    const timeoutSymbol = Symbol("timeout");
    const result = await Promise.race([cb(), new Promise<symbol>((res) => setTimeout(res, 5000, timeoutSymbol))]);
    if (result === timeoutSymbol) {
        throw new Error(errorMessage);
    }
    return result as T;
}
