export declare const MACOS_PLATFORM_VERSIONS: readonly string[];
export declare const WINDOWS_PLATFORM_VERSIONS: readonly string[];
export declare const LINUX_PLATFORM_VERSIONS: readonly string[];
type HwPair = readonly [cores: number, gib: number];
export declare const MAC_HW_CONFIGS: Readonly<Record<string, readonly HwPair[]>>;
/** Real x86 logical-core counts (SMT + Intel hybrid). Same array as lib.rs. */
export declare const X86_CORES: readonly number[];
/** Mutates in-place: pick fresh `navigator.platform_version` (+ mirror to client_hints). */
export declare function randomizePlatformVersion(cfg: Record<string, unknown>): void;
/**
 * Mutates in-place: pick fresh (hardware_concurrency, device_memory).
 *
 * macOS: curated MAC_HW_CONFIGS table by profile id.
 * Windows / Linux: bracket the host CPU count within [C-4, C+2] from
 * X86_CORES; floor device_memory by core count (>=12 → 16, else 8) and
 * cap by `hostRamBucketGb()`.
 */
export declare function randomizeHardware(cfg: Record<string, unknown>, profileId?: string): void;
export {};
//# sourceMappingURL=randomize.d.ts.map