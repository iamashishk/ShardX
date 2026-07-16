import { type Browser as PatchrightBrowser } from "patchright";
import { Runtime, type ProgressCb } from "./runtime.js";
import { FingerprintLibrary, Profile } from "./profile.js";
import { type LaunchOptions, type BrowserSession } from "./browser.js";
import { type GeoInfo } from "./geo.js";
export interface ShardXOptions {
    /** Where the engine, Widevine, and bundled fingerprint library live
     *  (defaults to the per-OS app-data dir). */
    cacheDir?: string;
    progress?: ProgressCb;
    /** Per-profile user-data-dir root (cookies, IndexedDB, cache).
     *  Defaults to `./shardx-profiles/` next to the running script. */
    profilesDir?: string;
}
export interface ShardXLaunchOptions extends LaunchOptions {
    /** When true, re-pick hardware_concurrency / device_memory / platform_version before launch. */
    randomize?: boolean;
}
export interface ProxyCheckResult {
    udpMs: number | null;
    geo: GeoInfo;
    wouldEnableQuic: boolean;
    wouldSetWebrtc: "auto" | "tcp_only";
}
export declare class ShardX {
    readonly runtime: Runtime;
    readonly library: FingerprintLibrary;
    private readonly browser;
    constructor(opts?: ShardXOptions);
    /** All bundled fingerprint ids, optionally filtered by `navigator.platform`.
     *  Auto-installs the fingerprint library on first call. */
    listProfiles(opts?: {
        platform?: string;
        checkInstalled?: boolean;
    }): Promise<string[]>;
    /** Pick a random profile from the library.  Auto-installs on first call. */
    randomProfile(opts?: {
        platform?: string;
        checkInstalled?: boolean;
    }): Promise<Profile>;
    /** Create a new persistent profile from a library template (or a random one
     *  when `template` is omitted), enriched with randomized hardware +
     *  platform_version under a fresh unique id, and frozen to disk. Launch it
     *  with `launch(profile, { randomize: false })`. */
    createProfile(template?: string, opts?: {
        platform?: string;
        checkInstalled?: boolean;
    }): Promise<Profile>;
    /** Persist a profile's current config to its on-disk folder. Call after
     *  mutating a reopened profile (e.g. `setNoise`) to keep changes. */
    saveProfile(profile: Profile): void;
    /** Reopen a previously created profile by id (same fingerprint + state). */
    openProfile(id: string): Profile;
    /** Ids of every saved profile, sorted. */
    listSavedProfiles(): string[];
    /** Delete a saved profile and all its state (cookies, cache, …). */
    deleteProfile(id: string): void;
    private profileJsonPath;
    /**
     * Launch a profile. Get one from `createProfile()` (recommended — a
     * persistent profile), `Profile.fromFile()`, or pass your own config object.
     * Library templates aren't launched directly: go through `createProfile` so
     * each run has a stable identity and the bundled fingerprint library stays
     * untouched.
     *
     * @param profile  A `Profile` (or a raw config object).
     * @param opts.randomize When true, re-roll hw_concurrency / device_memory /
     *   platform_version first. Leave it off for a saved profile or its frozen
     *   fingerprint will drift.
     * All other options forwarded to `Browser.launch` (proxy, cdp, headless, webrtc, screenMode, …).
     */
    launch(profile: Profile | Record<string, unknown>, opts?: ShardXLaunchOptions): Promise<BrowserSession>;
    /**
     * Launch a profile AND connect patchright in one call.  Returns an
     * object with the patchright `Browser`, the raw `BrowserSession`, and
     * a `close()` that tears both down.
     *
     * Requires `patchright` (`npm install patchright`) as an optional
     * peer-dependency.
     *
     * @example
     * const profile = await sdk.createProfile("win-rtx4060");
     * const { browser, close } = await sdk.session(profile, { proxy: "socks5://…" });
     * try {
     *   const page = await browser.contexts()[0].newPage();
     *   await page.goto("https://example.com");
     * } finally {
     *   await close();
     * }
     */
    session(profile: Profile | Record<string, unknown>, opts?: ShardXLaunchOptions): Promise<{
        browser: PatchrightBrowser;
        session: BrowserSession;
        close: () => Promise<void>;
    }>;
    /**
     * Validate a proxy URL before binding it to a profile. Returns the same
     * data the launcher uses to decide QUIC + WebRTC policy.
     */
    checkProxy(proxyUrl: string): Promise<ProxyCheckResult>;
}
export { Runtime, defaultCacheDir, PUB_BASE, CHROMIUM_VERSION, hostSpec } from "./runtime.js";
export type { ProgressCb, HostSpec, Archive } from "./runtime.js";
export { Profile, FingerprintLibrary, userDataDir, applyEngineVersion } from "./profile.js";
export { Browser, BrowserSession } from "./browser.js";
export type { LaunchOptions, WebRtcMode, ScreenMode } from "./browser.js";
export { parseProxy, probeUdp, proxyToArg } from "./proxy.js";
export type { ParsedProxy } from "./proxy.js";
export { randomizeHardware, randomizePlatformVersion, MAC_HW_CONFIGS, X86_CORES, MACOS_PLATFORM_VERSIONS, WINDOWS_PLATFORM_VERSIONS, LINUX_PLATFORM_VERSIONS, } from "./randomize.js";
export { hostLogicalCores, hostRamGb, hostRamBucketGb, hostScreenSize, } from "./host.js";
export type { Size } from "./host.js";
export { applyScreenStrategy, defaultScreenModeFor } from "./screen.js";
export type { ScreenStrategy } from "./screen.js";
export { geoCheckVia } from "./geo.js";
export type { GeoInfo, GeoProvider } from "./geo.js";
export { hasAutoFields, resolveAutoFields } from "./autoResolve.js";
//# sourceMappingURL=index.d.ts.map