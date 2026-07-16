export type ScreenStrategy = "profile" | "cap_to_host" | "use_host";
export declare function applyScreenStrategy(cfg: Record<string, unknown>, mode: ScreenStrategy | string): void;
/** Map `navigator.platform` → the launcher's default screen mode. */
export declare function defaultScreenModeFor(platform: string): ScreenStrategy;
//# sourceMappingURL=screen.d.ts.map