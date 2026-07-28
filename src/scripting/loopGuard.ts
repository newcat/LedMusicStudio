import type ts from "typescript";

/** The name the guard call is emitted as. Injected into every compiled module alongside the rest of the scripting API. */
export const LOOP_GUARD_NAME = "__lmsLoopGuard";

/**
 * Iterations allowed within one tick across all loops in a script.
 *
 * Generous enough that real work never trips it — painting a 300 pixel strip with nested loops is a few thousand — but small
 * enough that a runaway loop is caught in single-digit milliseconds rather than hanging the app.
 */
const DEFAULT_BUDGET = 1_000_000;

export class LoopBudget {
    private remaining = DEFAULT_BUDGET;

    public reset(): void {
        this.remaining = DEFAULT_BUDGET;
    }

    public step(): void {
        if (--this.remaining < 0) {
            this.remaining = DEFAULT_BUDGET;
            throw new Error(
                `Script exceeded ${DEFAULT_BUDGET.toLocaleString()} loop iterations in a single tick. ` +
                    `A loop is probably missing a \`yield\` — without one it never gives the tick back.`
            );
        }
    }
}

/**
 * Injects a budget check at the top of every loop body.
 *
 * Scripts run on the main thread with no sandbox, so `while (true) {}` would otherwise hard-freeze both the app and the offline
 * renderer with no way out. The budget is per tick rather than per loop, which is what makes the common sequence idiom —
 * `while (true) { ...; yield; }` — legal: the yield ends the tick and the budget starts again.
 */
export function createLoopGuardTransformer(tsInstance: typeof ts): ts.TransformerFactory<ts.SourceFile> {
    return (context) => {
        const factory = context.factory;

        const guardStatement = () =>
            factory.createExpressionStatement(
                factory.createCallExpression(factory.createIdentifier(LOOP_GUARD_NAME), undefined, [])
            );

        const guardBody = (statement: ts.Statement): ts.Statement =>
            tsInstance.isBlock(statement)
                ? factory.updateBlock(statement, [guardStatement(), ...statement.statements])
                : factory.createBlock([guardStatement(), statement], true);

        const visit = (node: ts.Node): ts.Node => {
            const visited = tsInstance.visitEachChild(node, visit, context);

            if (tsInstance.isForStatement(visited)) {
                return factory.updateForStatement(
                    visited,
                    visited.initializer,
                    visited.condition,
                    visited.incrementor,
                    guardBody(visited.statement)
                );
            } else if (tsInstance.isForInStatement(visited)) {
                return factory.updateForInStatement(visited, visited.initializer, visited.expression, guardBody(visited.statement));
            } else if (tsInstance.isForOfStatement(visited)) {
                return factory.updateForOfStatement(
                    visited,
                    visited.awaitModifier,
                    visited.initializer,
                    visited.expression,
                    guardBody(visited.statement)
                );
            } else if (tsInstance.isWhileStatement(visited)) {
                return factory.updateWhileStatement(visited, visited.expression, guardBody(visited.statement));
            } else if (tsInstance.isDoStatement(visited)) {
                return factory.updateDoStatement(visited, guardBody(visited.statement), visited.expression);
            }

            return visited;
        };

        return (sourceFile) => tsInstance.visitNode(sourceFile, visit) as ts.SourceFile;
    };
}
