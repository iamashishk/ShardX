// Top-level façade — bundles the runtime, fingerprint library, and
// browser launcher. Mirrors the Python `ShardX` class.
import { chromium } from "patchright";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Runtime } from "./runtime.js";
import { FingerprintLibrary, Profile } from "./profile.js";
import { Browser } from "./browser.js";
import { randomizeHardware, randomizePlatformVersion } from "./randomize.js";
import { parseProxy, probeUdp } from "./proxy.js";
import { geoCheckVia } from "./geo.js";
export class ShardX {
    runtime;
    library;
    browser;
    constructor(opts = {}) {
        this.runtime = new Runtime(opts);
        this.library = new FingerprintLibrary(this.runtime);
        this.browser = new Browser(this.runtime);
    }
    /** All bundled fingerprint ids, optionally filtered by `navigator.platform`.
     *  Auto-installs the fingerprint library on first call. */
    async listProfiles(opts = {}) {
        if (opts.checkInstalled ?? !this.runtime.checkManifest()) {
            await this.runtime.install();
        }
        return opts.platform ? Array.from(this.library.filter({ platform: opts.platform })) : this.library.ids();
    }
    /** Pick a random profile from the library.  Auto-installs on first call. */
    async randomProfile(opts = {}) {
        const ids = await this.listProfiles(opts);
        if (ids.length === 0) {
            throw new Error(`No bundled profiles found${opts.platform ? ` for platform=${opts.platform}` : ""}. Did you call ensureInstalled()?`);
        }
        return this.library.load(ids[Math.floor(Math.random() * ids.length)]);
    }
    // ---- persistent profiles ----
    //
    // A *saved profile* is a frozen, uniquely-id'd copy of a library template
    // (or a random one) enriched with randomized hardware/platform_version — the
    // same thing the desktop launcher does on "create profile". It lives in its
    // own folder `<profilesRoot>/<id>/` together with its browser state, so you
    // can reopen the exact same profile later or delete it.
    /** Create a new persistent profile from a library template (or a random one
     *  when `template` is omitted), enriched with randomized hardware +
     *  platform_version under a fresh unique id, and frozen to disk. Launch it
     *  with `launch(profile, { randomize: false })`. */
    async createProfile(template, opts = {}) {
        if (opts.checkInstalled ?? !this.runtime.checkManifest()) {
            await this.runtime.install();
        }
        const src = template == null
            ? await this.randomProfile({ platform: opts.platform })
            : this.library.load(template);
        const id = randomUUID().replace(/-/g, "");
        const profile = new Profile(src.config, id); // ctor deep-clones
        // Seed hardware by the new id so the pick is stable across reopens.
        randomizeHardware(profile.config, id);
        randomizePlatformVersion(profile.config);
        this.saveProfile(profile);
        return profile;
    }
    /** Persist a profile's current config to its on-disk folder. Call after
     *  mutating a reopened profile (e.g. `setNoise`) to keep changes. */
    saveProfile(profile) {
        mkdirSync(join(this.runtime.profilesRoot, profile.id), { recursive: true });
        writeFileSync(this.profileJsonPath(profile.id), JSON.stringify(profile.config, null, 2));
    }
    /** Reopen a previously created profile by id (same fingerprint + state). */
    openProfile(id) {
        const path = this.profileJsonPath(id);
        if (!existsSync(path))
            throw new Error(`saved profile '${id}' not found`);
        return new Profile(JSON.parse(readFileSync(path, "utf8")), id);
    }
    /** Ids of every saved profile, sorted. */
    listSavedProfiles() {
        const root = this.runtime.profilesRoot;
        if (!existsSync(root))
            return [];
        return readdirSync(root, { withFileTypes: true })
            .filter((e) => e.isDirectory() && existsSync(join(root, e.name, "profile.json")))
            .map((e) => e.name)
            .sort();
    }
    /** Delete a saved profile and all its state (cookies, cache, …). */
    deleteProfile(id) {
        const d = join(this.runtime.profilesRoot, id);
        if (existsSync(d))
            rmSync(d, { recursive: true, force: true });
    }
    profileJsonPath(id) {
        return join(this.runtime.profilesRoot, id, "profile.json");
    }
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
    async launch(profile, opts = {}) {
        if (!(profile instanceof Profile)) {
            if (profile && typeof profile === "object") {
                profile = new Profile(profile);
            }
            else {
                throw new TypeError("launch() takes a Profile (or config object). To launch a library " +
                    "template or a random one, call createProfile(...) first, then launch " +
                    "the returned profile.");
            }
        }
        if (opts.checkInstalled ?? !this.runtime.checkManifest()) {
            await this.runtime.install();
        }
        if (opts.randomize) {
            randomizeHardware(profile.config, profile.id);
            randomizePlatformVersion(profile.config);
        }
        const { randomize: _r, ...launchOpts } = opts;
        return this.browser.launch(profile, launchOpts);
    }
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
    async session(profile, opts = {}) {
        const sess = await this.launch(profile, { ...opts, cdp: true });
        if (!sess.cdpUrl) {
            await sess.stop();
            throw new Error("CDP endpoint unavailable — engine failed to expose remote-debugging port");
        }
        const browser = await chromium.connectOverCDP(sess.cdpUrl);
        return {
            browser,
            session: sess,
            async close() {
                try {
                    await browser.close();
                }
                catch { /* ignore */ }
                await sess.stop();
            },
        };
    }
    /**
     * Validate a proxy URL before binding it to a profile. Returns the same
     * data the launcher uses to decide QUIC + WebRTC policy.
     */
    async checkProxy(proxyUrl) {
        const parsed = parseProxy(proxyUrl);
        const udpMs = parsed.scheme === "socks5" ? await probeUdp(parsed) : null;
        const geo = await geoCheckVia(parsed);
        const udpOk = udpMs !== null;
        return {
            udpMs,
            geo,
            wouldEnableQuic: udpOk,
            wouldSetWebrtc: udpOk ? "auto" : "tcp_only",
        };
    }
}
export { Runtime, defaultCacheDir, PUB_BASE, CHROMIUM_VERSION, hostSpec } from "./runtime.js";
export { Profile, FingerprintLibrary, userDataDir, applyEngineVersion } from "./profile.js";
export { Browser, BrowserSession } from "./browser.js";
export { parseProxy, probeUdp, proxyToArg } from "./proxy.js";
export { randomizeHardware, randomizePlatformVersion, MAC_HW_CONFIGS, X86_CORES, MACOS_PLATFORM_VERSIONS, WINDOWS_PLATFORM_VERSIONS, LINUX_PLATFORM_VERSIONS, } from "./randomize.js";
export { hostLogicalCores, hostRamGb, hostRamBucketGb, hostScreenSize, } from "./host.js";
export { applyScreenStrategy, defaultScreenModeFor } from "./screen.js";
export { geoCheckVia } from "./geo.js";
export { hasAutoFields, resolveAutoFields } from "./autoResolve.js";
//# sourceMappingURL=index.js.map