/** Logical CPU count (SMT threads). Falls back to 8 if `os.cpus()` is empty. */
export declare function hostLogicalCores(): number;
/** Physical RAM in GiB, best-effort per OS. `null` on failure. */
export declare function hostRamGb(): number | null;
/** Round host RAM to Chrome's deviceMemory bucket {8,16,32}; null → 16. */
export declare function hostRamBucketGb(): number;
export type Size = readonly [width: number, height: number];
/** Primary monitor (width, height) in CSS pixels, or null on failure. */
export declare function hostScreenSize(): Size | null;
//# sourceMappingURL=host.d.ts.map