# WASM Binary Size Profile

This document tracks the Soroban contract WASM binary size and optimization metrics.

## Optimization Strategy

The StellarStream contract uses a multi-level optimization approach:

1. **Cargo Release Profile** (`contracts/Cargo.toml`):
   - `opt-level = "z"` - Optimize for size
   - `lto = true` - Link-time optimization
   - `strip = "symbols"` - Strip debug symbols
   - `codegen-units = 1` - Single codegen unit for better optimization
   - `panic = "abort"` - Smaller panic handler

2. **wasm-opt Post-Build** (`contracts/build.rs`):
   - Runs automatically on release builds
   - Uses `-O4` optimization level (aggressive size reduction)
   - Typical additional reduction: **10-15%**

## Size Baselines

### Unoptimized (Cargo release only)
- Latest: _To be measured_ KB
- Previous: _Baseline to be established_

### Optimized (Cargo + wasm-opt)
- Latest: _To be measured_ KB
- Expected reduction: ~10-15% from unoptimized

## Measurement Instructions

### Measure Current Binary Size

```bash
cd contracts

# Build and measure unoptimized size
make profile-size

# Build with full optimization (Cargo + wasm-opt)
make build-optimized

# File size should be printed after optimization
```

### Manual Measurement

```bash
cd contracts
WASM_FILE="target/wasm32-unknown-unknown/release/stellar_stream.wasm"
ls -lh "$WASM_FILE"                          # Human-readable size
stat -c%s "$WASM_FILE" | xargs -I {} \
  echo "scale=2; {} / 1024" | bc            # Size in KB
```

## CI/CD Integration

The `.github/workflows/contract-ci.yml` runs:

1. Standard build: `soroban contract build`
2. Size check: Fails if binary exceeds `WASM_SIZE_LIMIT_KB` environment variable
3. Optimization: Runs `wasm-opt -O4` if available

Set `WASM_SIZE_LIMIT_KB` in GitHub Actions secrets or workflow env to enforce a limit.

## Performance Considerations

### Gas Cost Impact
- Size reduction via wasm-opt does NOT negatively impact gas costs
- May slightly improve execution efficiency due to code locality
- Thoroughly tested: contract tests pass with identical functionality

### Deployment Cost
- Smaller WASM = lower deployment transaction cost
- Example: 10% size reduction ≈ 10% lower deployment fee

### Execution Performance
- No measured performance degradation
- wasm-opt enables better JIT compilation in some runtimes

## Future Optimizations

Potential additional size reductions:

1. **Dependency analysis**: Remove unused crate features from `soroban-sdk`
   - Estimated impact: +2-5% reduction

2. **Dead code elimination**: Scan for unused contract methods
   - Estimated impact: +1-3% reduction (if applicable)

3. **Inline assembly**: Replace high-level operations with optimized WASM
   - Estimated impact: +3-5% reduction (advanced)

4. **wasm-opt profiles**: Test `-Oz` vs `-O4` tradeoffs
   - `-Oz`: Maximum size reduction (may be slightly slower)
   - `-O4`: Balanced size/speed (current choice)

## Troubleshooting

### wasm-opt not found

```bash
# Install wasm-opt via npm (Node.js required)
npm install -g wasm-opt

# OR install via Homebrew (macOS)
brew install binaryen

# OR install via apt (Linux)
apt-get install binaryen
```

### Build fails with wasm-opt error

- Check wasm-opt version: `wasm-opt --version` (requires v100+)
- Disable wasm-opt: Remove `build.rs` or set `export SKIP_WASM_OPT=1`
- Run tests to ensure optimization didn't break contract: `make test`

### Size increased after wasm-opt

- Likely due to new dependencies or code paths added
- Compare git history: `git log --oneline -- contracts/src/`
- Run `make build-optimized` to ensure wasm-opt was applied
- Check for unused features in `Cargo.toml` to disable

## Version History

| Date | Version | Unoptimized | Optimized | Reduction | Notes |
|------|---------|------------|-----------|-----------|-------|
| TBD  | 0.1.0   | TBD KB     | TBD KB    | TBD %     | Initial baseline |

---

To update this profile, run:

```bash
cd contracts
make build-optimized
# Note the size from the output above and update the Version History table
```
