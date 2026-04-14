import type { OvertoneEmailMeta } from "./types.js";

const registry = new Map<string, OvertoneEmailMeta>();

export function registerEmailAction(id: string, meta: OvertoneEmailMeta): void {
    registry.set(id, meta);
}

export function getRegisteredActions(): Array<{ id: string; meta: OvertoneEmailMeta }> {
    return Array.from(registry.entries()).map(([id, meta]) => ({ id, meta }));
}

export function clearActionRegistry(): void {
    registry.clear();
}
