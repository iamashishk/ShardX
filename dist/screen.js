// Screen strategies — three modes that match what the launcher does in
// `clamp_screen_to_real_display` (`src-tauri/src/lib.rs`):
//
//   "profile"     — keep whatever the fingerprint claims.
//   "cap_to_host" — macOS default. Scale screen/window down if host is
//                   smaller than the FP claim; no-op otherwise.
//   "use_host"    — Win/Linux default. Overwrite screen/window with the
//                   host display, subtract a taskbar inset for avail_h.
//
// All modes leave DPR / color_depth / orientation / etc. untouched.
import { platform as osPlatform } from "node:os";
import { hostScreenSize } from "./host.js";
export function applyScreenStrategy(cfg, mode) {
    if (mode === "profile")
        return;
    const host = hostScreenSize();
    if (!host)
        return;
    const [hw, hh] = host;
    if (mode === "cap_to_host")
        capToHost(cfg, hw, hh);
    else if (mode === "use_host")
        useHost(cfg, hw, hh);
}
function asInt(v) {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? Math.floor(n) : 0;
}
function capToHost(cfg, hw, hh) {
    const scr = cfg["screen"];
    if (!scr || typeof scr !== "object")
        return;
    const fpW = asInt(scr["width"]);
    const fpH = asInt(scr["height"]);
    if (fpW <= 0 || fpH <= 0)
        return;
    if (hw >= fpW && hh >= fpH)
        return;
    const ratio = Math.min(hw / fpW, hh / fpH);
    const newW = Math.max(1, Math.round(fpW * ratio));
    const newH = Math.max(1, Math.round(fpH * ratio));
    const fpAw = asInt(scr["avail_width"]) || fpW;
    const fpAh = asInt(scr["avail_height"]) || fpH;
    const newAw = Math.max(1, Math.round(fpAw * ratio));
    const newAh = Math.max(1, Math.round(fpAh * ratio));
    scr["width"] = newW;
    scr["height"] = newH;
    scr["avail_width"] = newAw;
    scr["avail_height"] = newAh;
    const win = cfg["window"];
    if (win && typeof win === "object") {
        for (const k of ["outer_width", "inner_width", "outer_height", "inner_height"]) {
            const v = asInt(win[k]);
            if (v > 0)
                win[k] = Math.max(1, Math.round(v * ratio));
        }
    }
}
function useHost(cfg, hw, hh) {
    const taskbar = osPlatform() === "win32" ? 40 : 0;
    const availW = hw;
    const availH = Math.max(1, hh - taskbar);
    const scr = (cfg["screen"] ??= {});
    scr["width"] = hw;
    scr["height"] = hh;
    scr["avail_width"] = availW;
    scr["avail_height"] = availH;
    const win = (cfg["window"] ??= {});
    win["outer_width"] = availW;
    win["outer_height"] = Math.max(1, availH - 1);
    win["inner_width"] = availW;
    win["inner_height"] = Math.max(1, availH - 88);
}
/** Map `navigator.platform` → the launcher's default screen mode. */
export function defaultScreenModeFor(platform) {
    if (platform === "macOS")
        return "cap_to_host";
    if (platform === "Windows" || platform === "Linux")
        return "use_host";
    return "profile";
}
//# sourceMappingURL=screen.js.map