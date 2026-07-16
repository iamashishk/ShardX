import { type ChildProcess } from "node:child_process";
import { type GeoInfo } from "./geo.js";
import { Profile } from "./profile.js";
import type { Runtime } from "./runtime.js";
import { type ScreenStrategy } from "./screen.js";
export type WebRtcMode = "auto" | "block" | "tcp_only";
/** Legacy alias retained for back-compat; prefer `ScreenStrategy`. */
export type ScreenMode = ScreenStrategy;
export interface LaunchOptions {
    proxy?: string;
    cdp?: boolean;
    headless?: boolean;
    extraArgs?: string[];
    env?: Record<string, string>;
    webrtc?: WebRtcMode;
    webrtcPublicIp?: string;
    /** Override the UDP-probe auto-decision. */
    quic?: boolean;
    /** Defaults to "cap_to_host" on macOS, "use_host" on Win/Linux. */
    screenMode?: ScreenStrategy;
    probeTimeoutMs?: number;
    /** Custom user-data-dir root. Defaults to ./shardx-profiles/<id>/. */
    userDataDir?: string;
}
export declare class BrowserSession {
    readonly pid: number;
    readonly userDataDir: string;
    readonly cdpUrl: string | null;
    readonly process: ChildProcess;
    readonly proxyUdpMs: number | null;
    readonly quicEnabled: boolean;
    readonly webrtcMode: WebRtcMode;
    readonly geo: GeoInfo | null;
    private _stopped;
    constructor(pid: number, userDataDir: string, cdpUrl: string | null, process: ChildProcess, proxyUdpMs?: number | null, quicEnabled?: boolean, webrtcMode?: WebRtcMode, geo?: GeoInfo | null);
    stop(timeoutMs?: number): Promise<void>;
}
export declare class Browser {
    private readonly runtime;
    constructor(runtime: Runtime);
    launch(profile: Profile, opts?: LaunchOptions): Promise<BrowserSession>;
}
//# sourceMappingURL=browser.d.ts.map