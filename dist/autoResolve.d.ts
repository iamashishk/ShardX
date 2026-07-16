import type { ParsedProxy } from "./proxy.js";
export declare function hasAutoFields(cfg: Record<string, unknown>): boolean;
/**
 * Apply the launcher's "auto" resolution. Returns the GeoInfo that fed the
 * resolution, or null when both proxy + direct probes failed and the host
 * fallback was used.
 */
export declare function resolveAutoFields(cfg: Record<string, unknown>, proxy: ParsedProxy | null, directProvider?: {
    url: string;
    callback: Function;
} | null): Promise<any | null>;
//# sourceMappingURL=autoResolve.d.ts.map