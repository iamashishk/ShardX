import type { ParsedProxy } from "./proxy.js";
export type GeoProvider = "ip-api.com" | "ipapi.co" | "ipwho.is";
export interface GeoInfo {
    ip: string;
    country: string;
    /** ISO-3166 alpha-2. */
    countryCode: string;
    region: string;
    city: string;
    isp: string;
    /** IANA. */
    timezone: string;
    latitude: number;
    longitude: number;
    provider: string;
    /** Comma-separated ISO-639-1; only ipapi.co populates it. */
    languages?: string;
}
/**
 * Probe the geo `proxy` exits at, or direct geo when `proxy` is null.
 * Throws on network error or provider-level fail (e.g. ip-api.com status=fail).
 */
export declare function geoCheckVia(proxy: ParsedProxy | null, provider?: GeoProvider | string): Promise<GeoInfo>;
//# sourceMappingURL=geo.d.ts.map