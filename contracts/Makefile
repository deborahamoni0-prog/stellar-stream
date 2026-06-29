.PHONY: build build-optimized clean profile-size help test

# Default Soroban build directory
WASM_FILE := target/wasm32-unknown-unknown/release/stellar_stream.wasm
ARCHIVE_FILE := ../SIZE_PROFILE.md

help:
	@echo "StellarStream Contract Build Targets"
	@echo "===================================="
	@echo "  make build           - Build contract with Cargo (wasm-opt runs automatically in release)"
	@echo "  make build-optimized - Build contract with explicit wasm-opt -O4 post-processing"
	@echo "  make profile-size    - Show WASM binary size and optimization impact"
	@echo "  make test            - Run contract tests"
	@echo "  make clean           - Remove build artifacts"
	@echo ""

build:
	@echo "Building contract with soroban-cli..."
	soroban contract build

build-optimized: build
	@if command -v wasm-opt >/dev/null 2>&1; then \
		echo "Optimizing WASM with wasm-opt -O4..."; \
		if [ -f "$(WASM_FILE)" ]; then \
			BEFORE=$$(stat -f%z "$(WASM_FILE)" 2>/dev/null || stat -c%s "$(WASM_FILE)"); \
			wasm-opt -O4 "$(WASM_FILE)" -o "$(WASM_FILE)"; \
			AFTER=$$(stat -f%z "$(WASM_FILE)" 2>/dev/null || stat -c%s "$(WASM_FILE)"); \
			PERCENT=$$(echo "scale=1; ($$BEFORE - $$AFTER) * 100 / $$BEFORE" | bc); \
			echo "✓ Optimization complete: $$BEFORE → $$AFTER bytes ($$PERCENT% reduction)"; \
		else \
			echo "✗ WASM file not found at $(WASM_FILE)"; \
			exit 1; \
		fi; \
	else \
		echo "✗ wasm-opt not found in PATH"; \
		echo "  Install: npm install -g wasm-opt  OR  brew install binaryen"; \
		exit 1; \
	fi

profile-size: build
	@if [ -f "$(WASM_FILE)" ]; then \
		SIZE=$$(stat -f%z "$(WASM_FILE)" 2>/dev/null || stat -c%s "$(WASM_FILE)"); \
		SIZE_KB=$$(echo "scale=2; $$SIZE / 1024" | bc); \
		echo "Unoptimized WASM size: $$SIZE_KB KB ($$SIZE bytes)"; \
		echo ""; \
		echo "Run 'make build-optimized' to optimize the binary with wasm-opt -O4"; \
		if command -v wasm-opt >/dev/null 2>&1; then \
			echo ""; \
			echo "Expected optimization: ~10-15% size reduction"; \
		fi; \
	else \
		echo "✗ WASM file not found at $(WASM_FILE)"; \
		exit 1; \
	fi

test:
	@echo "Running contract tests..."
	cargo test

clean:
	@echo "Cleaning build artifacts..."
	cargo clean
	@echo "Done"
