export declare const PUB_BASE = "https://pub-e57a7c60f6934eb09a6600bf2fc59cdc.r2.dev";
export declare const CHROMIUM_VERSION = "149.0.7827.103";
export declare const MANIFEST_URL = "https://raw.githubusercontent.com/ProxyShard/ShardBrowser/main/runtime.json";
export declare function defaultCacheDir(): string;
export interface Archive {
    key: string;
    label: string;
}
export interface HostSpec {
    browser: Archive;
    widevine: Archive | null;
    binarySubpath: string[];
    widevineSubpath: string[];
}
export declare function hostSpec(): HostSpec;
export declare const FINGERPRINTS_ARCHIVE: Archive;
export type ProgressCb = (label: string, received: number, total: number) => void;
export declare class Runtime {
    readonly root: string;
    readonly spec: HostSpec;
    private readonly progress?;
    private readonly _profilesRoot?;
    /** Set after a successful in-process install() so subsequent launches
     *  skip the R2 HEAD round-trip (~1 s over a clean connection).  Cleared
     *  by `install({force: true})`. */
    private _checkedInProcess;
    /** Engine chromium version from the manifest (fallback to the build-time
     *  constant). Used by launch to normalise profile UA + client_hints. */
    private _chromiumVersion;
    /** GREASE brand/version from the manifest (rotates per release; can't be
     *  derived from the version number). Applied to profiles on launch. */
    private _greaseBrand?;
    private _greaseVersion?;
    constructor(opts?: {
        cacheDir?: string;
        progress?: ProgressCb;
        profilesDir?: string;
    });
    get manifestPath(): string;
    get binaryPath(): string;
    get fingerprintsDir(): string;
    /** Per-profile user-data-dir root. Defaults to `<cacheDir>/profiles/`;
     *  override via `new ShardX({ profilesDir })` or per-launch
     *  `userDataDir`. Resolved path is logged at launch time. */
    get profilesRoot(): string;
    get installed(): boolean;
    /** Engine chromium version (manifest-driven; set on install()). */
    get chromiumVersion(): string;
    /** GREASE brand from the manifest (e.g. "Not)A;Brand"); set on install(). */
    get greaseBrand(): string | undefined;
    /** GREASE version from the manifest (e.g. "24"); set on install(). */
    get greaseVersion(): string | undefined;
    /** Chromium version of the engine actually on disk (mac Framework
     *  `Versions/<ver>/`, win `<ver>.manifest`), or undefined on Linux. */
    private installedEngineVersion;
    /** Effective installed version. Trusts the version recorded at install time
     *  (authoritative — written only after a successful extract) over re-reading
     *  it off disk, which can carry stale files from a previous version. On-disk
     *  detection is the fallback for legacy installs with no recorded version. */
    private effectiveInstalledVersion;
    private loadManifest;
    private saveManifest;
    install(opts?: {
        force?: boolean;
    }): Promise<void>;
    /** Fetch the version manifest (GitHub raw) — one request that yields every
     *  archive's current etag + the chromium version, replacing per-archive HEADs
     *  against R2/S3. Empty archives / undefined version when unreachable. */
    private fetchManifest;
    private downloadAndExtract;
    private placeWidevine;
    private installFingerprints;
}
//# sourceMappingURL=runtime.d.ts.map