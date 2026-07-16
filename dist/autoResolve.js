// Resolve `"auto"` sentinels in a profile config — port of
// `resolve_auto_fields` in `src-tauri/src/launch.rs`. Reads the live geo
// (through the bound proxy when present, direct otherwise), falls back to
// the host TZ/locale on failure, then mutates `cfg` in place to write
// concrete timezone / navigator.language / accept_language / languages /
// icu_locale / geolocation values.
import { readlinkSync } from "node:fs";
import { geoCheckVia } from "./geo.js";
/** ISO-3166 alpha-2 → BCP-47 locale.  Ported 1:1 from launcher's Rust
 *  `country_to_locale` (src-tauri/src/proxy.rs).  Authoritative table the
 *  desktop launcher uses — keep in sync if the Rust side ever changes. */
function countryToLocale(cc) {
    return CC_TO_LOCALE[(cc ?? "").toUpperCase()] ?? "en-US";
}
const CC_TO_LOCALE = { US: "en-US", CA: "en-CA", MX: "es-MX", AR: "es-AR", BO: "es-BO", BR: "pt-BR", CL: "es-CL", CO: "es-CO", EC: "es-EC", GY: "en-GY", PE: "es-PE", PY: "es-PY", SR: "nl-SR", UY: "es-UY", VE: "es-VE", AL: "sq-AL", AD: "ca-AD", AT: "de-AT", BE: "nl-BE", BG: "bg-BG", BY: "be-BY", CH: "de-CH", CY: "el-CY", CZ: "cs-CZ", DE: "de-DE", DK: "da-DK", EE: "et-EE", ES: "es-ES", FI: "fi-FI", FR: "fr-FR", GB: "en-GB", GR: "el-GR", HR: "hr-HR", HU: "hu-HU", IE: "en-IE", IS: "is-IS", IT: "it-IT", LT: "lt-LT", LU: "fr-LU", LV: "lv-LV", MC: "fr-MC", MD: "ro-MD", ME: "sr-ME", MK: "mk-MK", MT: "mt-MT", NL: "nl-NL", NO: "nb-NO", PL: "pl-PL", PT: "pt-PT", RO: "ro-RO", RS: "sr-RS", RU: "ru-RU", SE: "sv-SE", SI: "sl-SI", SK: "sk-SK", SM: "it-SM", UA: "uk-UA", VA: "it-VA", AE: "ar-AE", AF: "fa-AF", AM: "hy-AM", AZ: "az-AZ", BD: "bn-BD", BH: "ar-BH", BN: "ms-BN", CN: "zh-CN", GE: "ka-GE", HK: "zh-HK", ID: "id-ID", IL: "he-IL", IN: "en-IN", IQ: "ar-IQ", IR: "fa-IR", JO: "ar-JO", JP: "ja-JP", KG: "ky-KG", KH: "km-KH", KP: "ko-KP", KR: "ko-KR", KW: "ar-KW", KZ: "kk-KZ", LA: "lo-LA", LB: "ar-LB", LK: "si-LK", MM: "my-MM", MN: "mn-MN", MO: "zh-MO", MY: "ms-MY", NP: "ne-NP", OM: "ar-OM", PH: "fil-PH", PK: "ur-PK", QA: "ar-QA", SA: "ar-SA", SG: "en-SG", SY: "ar-SY", TH: "th-TH", TJ: "tg-TJ", TM: "tk-TM", TW: "zh-TW", UZ: "uz-UZ", VN: "vi-VN", YE: "ar-YE", DZ: "ar-DZ", AO: "pt-AO", BW: "en-BW", CM: "fr-CM", EG: "ar-EG", ET: "am-ET", GH: "en-GH", KE: "sw-KE", MA: "ar-MA", MU: "en-MU", MZ: "pt-MZ", NA: "en-NA", NG: "en-NG", RW: "rw-RW", SN: "fr-SN", TN: "ar-TN", TZ: "sw-TZ", UG: "en-UG", ZA: "en-ZA", ZM: "en-ZM", ZW: "en-ZW", AU: "en-AU", FJ: "en-FJ", NZ: "en-NZ", PG: "en-PG", WS: "sm-WS" };
/** Country → IANA timezone fallback for providers that omit timezone.
 *  Ported 1:1 from launcher's Rust `country_to_timezone`. */
function countryToTimezone(cc) {
    return CC_TO_TZ[(cc ?? "").toUpperCase()] ?? "UTC";
}
const CC_TO_TZ = {
    US: "America/New_York", CA: "America/Toronto",
    GB: "Europe/London", UK: "Europe/London",
    DE: "Europe/Berlin", FR: "Europe/Paris", ES: "Europe/Madrid",
    IT: "Europe/Rome", NL: "Europe/Amsterdam", PL: "Europe/Warsaw",
    PT: "Europe/Lisbon", RO: "Europe/Bucharest", RU: "Europe/Moscow",
    UA: "Europe/Kyiv", TR: "Europe/Istanbul", GR: "Europe/Athens",
    CZ: "Europe/Prague", HU: "Europe/Budapest",
    SE: "Europe/Stockholm", FI: "Europe/Helsinki",
    NO: "Europe/Oslo", DK: "Europe/Copenhagen",
    CH: "Europe/Zurich", AT: "Europe/Vienna",
    BR: "America/Sao_Paulo", AR: "America/Argentina/Buenos_Aires",
    MX: "America/Mexico_City",
    AU: "Australia/Sydney", NZ: "Pacific/Auckland",
    IN: "Asia/Kolkata", ID: "Asia/Jakarta", MY: "Asia/Kuala_Lumpur",
    SG: "Asia/Singapore", TH: "Asia/Bangkok", VN: "Asia/Ho_Chi_Minh",
    CN: "Asia/Shanghai", HK: "Asia/Hong_Kong", TW: "Asia/Taipei",
    JP: "Asia/Tokyo", KR: "Asia/Seoul",
    IL: "Asia/Jerusalem", SA: "Asia/Riyadh", AE: "Asia/Dubai",
};
export function hasAutoFields(cfg) {
    if (cfg["timezone"] === "auto")
        return true;
    const nav = cfg["navigator"];
    if (nav && nav["language"] === "auto")
        return true;
    const geo = cfg["geolocation"];
    if (geo && typeof geo === "object" && geo["mode"] === "auto")
        return true;
    return false;
}
function hostTimezone() {
    const tz = (process.env.TZ ?? "").trim();
    if (tz && tz.includes("/"))
        return tz;
    try {
        const target = readlinkSync("/etc/localtime");
        for (const prefix of ["/usr/share/zoneinfo/", "/var/db/timezone/zoneinfo/"]) {
            const i = target.indexOf(prefix);
            if (i >= 0)
                return target.slice(i + prefix.length);
        }
    }
    catch { /* not a symlink / not unix */ }
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    }
    catch {
        return null;
    }
}
function hostLocale() {
    for (const v of [process.env.LANG, process.env.LC_ALL, process.env.LC_MESSAGES]) {
        if (!v)
            continue;
        const stripped = v.split(".", 1)[0].replace(/_/g, "-");
        if (stripped.includes("-"))
            return stripped;
    }
    return "en-US";
}
/**
 * Apply the launcher's "auto" resolution. Returns the GeoInfo that fed the
 * resolution, or null when both proxy + direct probes failed and the host
 * fallback was used.
 */
export async function resolveAutoFields(cfg, proxy, directProvider = null) {
    const wantTz = cfg["timezone"] === "auto";
    const nav = cfg["navigator"];
    const wantLang = !!(nav && nav["language"] === "auto");
    const geoCfg = cfg["geolocation"];
    const wantGeo = !!(geoCfg && typeof geoCfg === "object" && geoCfg["mode"] === "auto");
    if (!wantTz && !wantLang && !wantGeo)
        return null;
    let geo = null;
    if (proxy) {
        try {
            geo = await geoCheckVia(proxy, "ip-api.com", directProvider);
        }
        catch {
            geo = null;
        }
    }
    if (!geo) {
        try {
            geo = await geoCheckVia(null, "ip-api.com", directProvider);
        }
        catch {
            geo = null;
        }
    }
    let resolvedTz;
    let resolvedLocale;
    let lat;
    let lng;
    if (geo) {
        // Timezone: always from API. If the provider didn't return one,
        // fall back to the country-code table — NOT the host TZ (would
        // leak the launcher's real zone).
        resolvedTz = geo.timezone || countryToTimezone(geo.countryCode);
        resolvedLocale = countryToLocale(geo.countryCode);
        lat = geo.latitude !== 0 ? geo.latitude : null;
        lng = geo.longitude !== 0 ? geo.longitude : null;
    }
    else {
        resolvedTz = hostTimezone() ?? "UTC";
        resolvedLocale = hostLocale();
        lat = null;
        lng = null;
    }
    if (wantTz)
        cfg["timezone"] = resolvedTz;
    if (wantLang) {
        const base = resolvedLocale.split("-", 1)[0];
        const accept = resolvedLocale === "en-US"
            ? "en-US,en;q=0.9"
            : `${resolvedLocale},${base};q=0.9,en-US;q=0.8,en;q=0.7`;
        const languages = resolvedLocale === "en-US"
            ? ["en-US", "en"]
            : [resolvedLocale, base, "en-US", "en"];
        const navObj = (cfg["navigator"] ??= {});
        navObj["language"] = resolvedLocale;
        navObj["accept_language"] = accept;
        navObj["languages"] = languages;
        // Always overwrite — matches launch.rs (even hardcoded values are replaced).
        cfg["icu_locale"] = resolvedLocale;
    }
    if (wantGeo) {
        if (lat !== null && lng !== null) {
            cfg["geolocation"] = {
                mode: "manual",
                latitude: lat,
                longitude: lng,
                accuracy: 50.0,
            };
        }
        else {
            delete cfg["geolocation"];
        }
    }
    return {
        config: cfg,
        geo: geo,
    };
}
//# sourceMappingURL=autoResolve.js.map