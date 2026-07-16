export interface ParsedProxy {
    scheme: "socks5" | "http" | "https";
    host: string;
    port: number;
    username?: string;
    password?: string;
}
export declare function parseProxy(url: string): ParsedProxy;
/** Format as the ShardX engine's `--proxy-server` argument.  Includes
 *  URL-encoded `user:pass@` when present — the ShardX fork honours
 *  inline credentials in `--proxy-server` (stock Chromium does not)
 *  so this is the only mechanism the SDK needs to authenticate
 *  SOCKS5 / HTTP-proxy traffic.  Mirrors the launcher's Rust
 *  `ProxyEntry::to_proxy_server_arg` exactly. */
export declare function proxyToArg(p: ParsedProxy): string;
/** Return UDP RTT (ms) through the SOCKS5 relay, or null if unavailable. */
export declare function probeUdp(p: ParsedProxy, timeoutMs?: number): Promise<number | null>;
//# sourceMappingURL=proxy.d.ts.map