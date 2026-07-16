// Browser launch + lifecycle. Spawns the ShardX engine with the same
// spoofing flags the desktop launcher uses, plus pre-launch:
//
//   • resolveAutoFields    — fill timezone/language/geolocation from a
//     live geo lookup through the bound proxy.
//   • applyScreenStrategy — cap to host monitor (macOS) or replace with
//     the host monitor (Win/Linux), matching the launcher's
//     `clamp_screen_to_real_display` / `--shardx-real-screen` switch.
//   • probeUdp             — decide QUIC + WebRTC policy from a live
//     SOCKS5 UDP_ASSOCIATE probe.
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hasAutoFields, resolveAutoFields } from "./autoResolve.js";
import { geoCheckVia } from "./geo.js";
import { userDataDir, applyEngineVersion } from "./profile.js";
import { parseProxy, probeUdp, proxyToArg } from "./proxy.js";
import { applyScreenStrategy, defaultScreenModeFor } from "./screen.js";
const noiseDefault = () => ({
    canvas: { enabled: false, seed: 0 },
    webgl: { enabled: false, seed: 0, intensity: 0 },
    audio: { enabled: false, seed: 0 },
    client_rects: { enabled: false, seed: 0, max_offset: 0 },
    sensors: { enabled: false, seed: 0 },
    fonts: { enabled: false, seed: 0 },
});
/** Deterministic non-zero 32-bit FNV-1a of `<id>::<slot>`. */
function noiseSeed(id, slot) {
    let h = 2166136261;
    const s = `${id}::${slot}`;
    for (let i = 0; i < s.length; i++)
        h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    h >>>= 0;
    return h === 0 ? 1 : h;
}
/** Add the default noise block when absent, then fill any seed-0 vector with a
 *  stable per-profile value — without it every profile shares seed 0 and gets
 *  an identical canvas/audio/WebGL fingerprint. */
function applyNoiseSeeds(config, id) {
    let noise = config["noise"];
    if (!noise || typeof noise !== "object") {
        noise = noiseDefault();
        config["noise"] = noise;
    }
    for (const slot of Object.keys(noise)) {
        const block = noise[slot];
        if (block && typeof block === "object" && !block["seed"]) {
            block["seed"] = noiseSeed(id, slot);
        }
    }
}
export class BrowserSession {
    pid;
    userDataDir;
    cdpUrl;
    process;
    proxyUdpMs;
    quicEnabled;
    webrtcMode;
    geo;
    args;
    binaryPath;
    _stopped = false;
    constructor(pid, userDataDir, cdpUrl, process, proxyUdpMs = null, quicEnabled = false, webrtcMode = "auto", geo = null, args = undefined, binaryPath = undefined) {
        this.pid = pid;
        this.userDataDir = userDataDir;
        this.cdpUrl = cdpUrl;
        this.process = process;
        this.proxyUdpMs = proxyUdpMs;
        this.quicEnabled = quicEnabled;
        this.webrtcMode = webrtcMode;
        this.geo = geo;
        this.args = args;
        this.binaryPath = binaryPath;
    }
    async stop(timeoutMs = 5000) {
        if (this._stopped)
            return;
        this._stopped = true;
        if (!this.process.pid)
            return;
        try {
            this.process.kill("SIGTERM");
        }
        catch { /* already gone */ }
        const exited = await new Promise((resolve) => {
            const t = setTimeout(() => resolve(false), timeoutMs);
            this.process.once("exit", () => { clearTimeout(t); resolve(true); });
        });
        if (!exited) {
            try {
                this.process.kill("SIGKILL");
            }
            catch { /* ignore */ }
        }
    }
}
export class Browser {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    async launch(profile, opts = {}) {
        // Auto-install on first use (high-level ShardX.launch already does
        // this; the call is here too so low-level Browser.launch users
        // don't have to remember).
        if (opts.checkInstalled ?? !this.runtime.checkManifest()) {
            await this.runtime.install();
        }
        const parsed = opts.proxy ? parseProxy(opts.proxy) : null;
        // ---- pre-launch: auto-resolve, screen strategy, UDP probe ------
        let geo = null;
        if (hasAutoFields(profile.config)) {
            geo = (await resolveAutoFields(profile.config, parsed, opts.geoProvider ?? null)).geo ?? null;
        }
        const mode = opts.screenMode ?? defaultScreenModeFor(profile.platform);
        applyScreenStrategy(profile.config, mode);
        let proxyUdpMs = null;
        if (parsed && parsed.scheme === "socks5") {
            proxyUdpMs = await probeUdp(parsed, opts.probeTimeoutMs ?? 6000);
        }
        const udpOk = proxyUdpMs !== null;
        const quicEnabled = opts.quic ?? (parsed !== null && udpOk);
        let webrtcMode = opts.webrtc ?? "auto";
        if (webrtcMode === "auto" && parsed !== null && !udpOk)
            webrtcMode = "tcp_only";
        // ---- profile + udd ----------------------------------------------
        const udd = userDataDir(this.runtime, profile.id, opts.userDataDir);
        console.log(`[shardx] profile '${profile.id}' → ${udd}`);
        // Keep the spoofed Chrome version coherent with the installed engine,
        // regardless of where the profile config came from (library / file / dict).
        applyEngineVersion(profile.config, this.runtime.chromiumVersion, this.runtime.greaseBrand, this.runtime.greaseVersion);
        applyNoiseSeeds(profile.config, profile.id);
        const fpFile = join(udd, "fingerprint.json");
        writeFileSync(fpFile, JSON.stringify(profile.config));
        const argv = [
            `--fingerprint-profile=${fpFile}`,
            `--user-data-dir=${udd}`,
            "--no-first-run",
        ];
        if (!profile.hasWebGPU)
            argv.push("--disable-features=WebGPU");
        if (!opts.headless && !opts.cdp) {
            argv.push("--restore-last-session", "--hide-crash-restore-bubble");
        }
        // Engine-side real-screen switch only fires on use_host (where the SDK
        // already rewrote screen.* — keep them in sync with the launcher).
        if (mode === "use_host")
            argv.push("--shardx-real-screen");
        if (parsed) {
            argv.push(`--proxy-server=${proxyToArg(parsed)}`);
            argv.push(quicEnabled ? "--enable-quic" : "--disable-quic");
        }
        if (webrtcMode === "block") {
            argv.push("--force-webrtc-ip-handling-policy=disable_non_proxied_udp", "--shardx-webrtc-policy=block");
        }
        else if (webrtcMode === "tcp_only") {
            argv.push("--force-webrtc-ip-handling-policy=disable_non_proxied_udp", "--shardx-webrtc-policy=tcp_only");
            // Engine spoofs the public side of ICE candidates with this IP.
            // Match the launcher: ALWAYS resolve when proxy is bound — relying
            // on `geo` from auto-resolve only works when the profile has auto
            // sentinels, otherwise the engine falls back to the host IP.
            let ip = opts.webrtcPublicIp ?? geo?.ip;
            if (!ip && parsed) {
                try {
                    ip = (await geoCheckVia(parsed, "ip-api.com", opts.geoProvider ?? null)).ip || undefined;
                }
                catch { /* leave undefined */ }
            }
            if (ip)
                argv.push(`--shardx-webrtc-public-ip=${ip}`);
        }
        const cdpMarker = join(udd, "DevToolsActivePort");
        if (opts.cdp) {
            if (existsSync(cdpMarker))
                rmSync(cdpMarker, { force: true });
            argv.push("--remote-debugging-port=0", "--remote-allow-origins=*");
        }
        if (opts.headless)
            argv.push("--headless=new");
        if (opts.extraArgs)
            argv.push(...opts.extraArgs);
        if (opts.returnMode === "args") {
            const child = spawn(process.execPath, ["-e", ""], {
                env: { ...process.env, ...(opts.env ?? {}) },
                stdio: "ignore",
                detached: process.platform !== "win32",
            });
            return new BrowserSession(child.pid, udd, null, child, proxyUdpMs, quicEnabled, webrtcMode, geo, argv, this.runtime.binaryPath);
        }
        const child = spawn(this.runtime.binaryPath, argv, {
            env: { ...process.env, ...(opts.env ?? {}) },
            stdio: "ignore",
            detached: process.platform !== "win32",
        });
        const cdpUrl = opts.cdp ? await readCdpEndpoint(udd, 15_000) : null;
        return new BrowserSession(child.pid, udd, cdpUrl, child, proxyUdpMs, quicEnabled, webrtcMode, geo, argv, this.runtime.binaryPath);
    }
}
async function readCdpEndpoint(udd, timeoutMs) {
    const marker = join(udd, "DevToolsActivePort");
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (existsSync(marker)) {
            try {
                const firstLine = readFileSync(marker, "utf8").split("\n")[0].trim();
                const port = parseInt(firstLine, 10);
                if (!Number.isNaN(port)) {
                    const r = await fetch(`http://127.0.0.1:${port}/json/version`);
                    if (r.ok) {
                        const data = await r.json();
                        if (data.webSocketDebuggerUrl)
                            return data.webSocketDebuggerUrl;
                    }
                }
            }
            catch { /* keep polling */ }
        }
        await new Promise((r) => setTimeout(r, 100));
    }
    return null;
}
//# sourceMappingURL=browser.js.map