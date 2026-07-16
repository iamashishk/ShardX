// Profile = a fingerprint JSON + a per-launch working dir. Wraps the
// bundled fingerprint library and lets callers override fields before
// launch.
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
const NOISE_VECTORS = ["canvas", "webgl", "audio", "client_rects", "sensors", "fonts"];
// vector -> [soft knob, value applied when the vector is enabled]
const NOISE_KNOB = {
    webgl: ["intensity", 0.0005],
    client_rects: ["max_offset", 1],
};
export class Profile {
    id;
    config;
    constructor(config, id) {
        this.config = JSON.parse(JSON.stringify(config)); // deep clone
        this.id = id ?? config["name"] ?? "anonymous";
    }
    static fromFile(path) {
        const cfg = JSON.parse(readFileSync(path, "utf8"));
        const id = path.split(/[\\/]/).pop().replace(/\.json$/, "");
        return new Profile(cfg, id);
    }
    /** Shallow merge: object values are merged one level deep, scalars replaced. */
    withOverride(overrides) {
        const out = JSON.parse(JSON.stringify(this.config));
        for (const [k, v] of Object.entries(overrides)) {
            if (v && typeof v === "object" && !Array.isArray(v)
                && out[k] && typeof out[k] === "object" && !Array.isArray(out[k])) {
                out[k] = { ...out[k], ...v };
            }
            else {
                out[k] = v;
            }
        }
        return new Profile(out, overrides["name"] ?? this.id);
    }
    /** Enable exactly the named noise vectors (soft defaults) and disable the
     *  rest. Declarative — re-calling replaces the selection, so a dropped
     *  vector is turned off. Seeds are derived per-profile at launch.
     *
     *  @example p.setNoise("canvas", "audio")  // only these two on
     *  @example p.setNoise("canvas")           // audio now off again
     */
    setNoise(...vectors) {
        for (const v of vectors) {
            if (!NOISE_VECTORS.includes(v)) {
                throw new Error(`unknown noise vector: ${v} (valid: ${NOISE_VECTORS.join(", ")})`);
            }
        }
        const on = new Set(vectors);
        let noise = this.config["noise"];
        if (!noise || typeof noise !== "object") {
            noise = {};
            this.config["noise"] = noise;
        }
        for (const v of NOISE_VECTORS) {
            let block = noise[v];
            if (!block || typeof block !== "object") {
                block = {};
                noise[v] = block;
            }
            block["enabled"] = on.has(v);
            if (block["seed"] === undefined)
                block["seed"] = 0;
            const knob = NOISE_KNOB[v];
            if (on.has(v) && knob && block[knob[0]] === undefined)
                block[knob[0]] = knob[1];
        }
        return this;
    }
    get platform() {
        const nav = this.config["navigator"];
        return nav?.["platform"] ?? "";
    }
    get hasWebGPU() {
        const wgp = this.config["webgpu"];
        if (!wgp)
            return false;
        const limits = wgp["limits"];
        return !!(limits && typeof limits === "object" && Object.keys(limits).length > 0);
    }
}
export class FingerprintLibrary {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    ids() {
        return readdirSync(this.runtime.fingerprintsDir)
            .filter((f) => f.endsWith(".json"))
            .map((f) => f.replace(/\.json$/, ""))
            .sort();
    }
    *filter(opts = {}) {
        for (const id of this.ids()) {
            if (opts.platform) {
                try {
                    const p = this.load(id);
                    if (!p.platform.toLowerCase().includes(opts.platform.toLowerCase()))
                        continue;
                }
                catch {
                    continue;
                }
            }
            yield id;
        }
    }
    load(fingerprintId) {
        const path = join(this.runtime.fingerprintsDir, `${fingerprintId}.json`);
        if (!existsSync(path)) {
            const sample = this.ids().slice(0, 10).join(", ");
            throw new Error(`Fingerprint '${fingerprintId}' not found. Available: ${sample}…`);
        }
        return Profile.fromFile(path);
    }
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
export function applyEngineVersion(config, chromiumVersion, greaseBrand, greaseVersion) {
    const parts = chromiumVersion.split(".");
    if (parts.length !== 4)
        return;
    const major = parts[0];
    const build = parseInt(parts[2], 10);
    const patch = parseInt(parts[3], 10);
    const nav = config["navigator"];
    const ua = nav?.["user_agent"];
    if (nav && typeof ua === "string") {
        const idx = ua.indexOf("Chrome/");
        if (idx >= 0) {
            const rest = ua.slice(idx + 7);
            const end = rest.indexOf(" ");
            const tail = end >= 0 ? rest.slice(end) : "";
            nav["user_agent"] = `${ua.slice(0, idx)}Chrome/${major}.0.0.0${tail}`;
        }
    }
    const ch = config["client_hints"];
    if (ch && typeof ch === "object") {
        ch["brand_version"] = major;
        ch["brand_full_version"] = chromiumVersion;
        if (Number.isFinite(build))
            ch["chrome_build"] = build;
        if (Number.isFinite(patch))
            ch["chrome_patch"] = patch;
        if (greaseBrand)
            ch["grease_brand"] = greaseBrand;
        if (greaseVersion) {
            ch["grease_version"] = greaseVersion;
            ch["grease_full_version"] = `${greaseVersion}.0.0.0`;
        }
    }
}
/** Per-profile state (cookies / IndexedDB / cache) — preserved across
 *  launches. Defaults to `./shardx-profiles/<id>/` next to the running
 *  script. Override per launch with `userDataDir` or per SDK with
 *  `new ShardX({ profilesDir })`. */
export function userDataDir(runtime, profileId, base) {
    const root = base ?? runtime.profilesRoot;
    const d = join(root, profileId);
    mkdirSync(d, { recursive: true });
    return d;
}
//# sourceMappingURL=profile.js.map