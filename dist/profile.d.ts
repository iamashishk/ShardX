import type { Runtime } from "./runtime.js";
declare const NOISE_VECTORS: readonly ["canvas", "webgl", "audio", "client_rects", "sensors", "fonts"];
export type NoiseVector = (typeof NOISE_VECTORS)[number];
export declare class Profile {
    readonly id: string;
    config: Record<string, unknown>;
    constructor(config: Record<string, unknown>, id?: string);
    static fromFile(path: string): Profile;
    /** Shallow merge: object values are merged one level deep, scalars replaced. */
    withOverride(overrides: Record<string, unknown>): Profile;
    /** Enable exactly the named noise vectors (soft defaults) and disable the
     *  rest. Declarative — re-calling replaces the selection, so a dropped
     *  vector is turned off. Seeds are derived per-profile at launch.
     *
     *  @example p.setNoise("canvas", "audio")  // only these two on
     *  @example p.setNoise("canvas")           // audio now off again
     */
    setNoise(...vectors: NoiseVector[]): this;
    get platform(): string;
    get hasWebGPU(): boolean;
}
export declare class FingerprintLibrary {
    private readonly runtime;
    constructor(runtime: Runtime);
    ids(): string[];
    filter(opts?: {
        platform?: string;
    }): Generator<string>;
    load(fingerprintId: string): Profile;
}
/**
 * Normalise a profile config's spoofed Chrome version to `chromiumVersion`
 * (e.g. "149.0.7827.103") so it always matches the running engine — bumps
 * `navigator.user_agent` (Chrome/<major>.0.0.0) and the version fields in
 * `client_hints`: brand_version / brand_full_version / chrome_build /
 * chrome_patch (derived from the version) plus, when supplied, grease_brand /
 * grease_version / grease_full_version (GREASE rotates per release, so it can't
 * be derived — it comes from the manifest). Leaves platform_version,
 * architecture, etc. intact. Mutates `config` in place. SDK equivalent of the
 * launcher's post-update profile migration.
 */
export declare function applyEngineVersion(config: Record<string, unknown>, chromiumVersion: string, greaseBrand?: string, greaseVersion?: string): void;
/** Per-profile state (cookies / IndexedDB / cache) — preserved across
 *  launches. Defaults to `./shardx-profiles/<id>/` next to the running
 *  script. Override per launch with `userDataDir` or per SDK with
 *  `new ShardX({ profilesDir })`. */
export declare function userDataDir(runtime: Runtime, profileId: string, base?: string): string;
export {};
//# sourceMappingURL=profile.d.ts.map