#!/bin/bash
set -e

cd contracts
cargo test --test benchmarks -- --nocapture | grep "BENCHMARK|" > .current_bench.tmp

echo "Checking benchmarks against BENCHMARKS.md baseline..."
FAILED=0

while IFS='|' read -r prefix func cpu_current mem_current; do
    baseline_line=$(grep "| $func |" BENCHMARKS.md || true)
    
    if [ -z "$baseline_line" ]; then
        echo "❌ No baseline found for $func."
        FAILED=1
        continue
    fi

    cpu_baseline=$(echo "$baseline_line" | awk -F'|' '{print $3}' | tr -d ' ')
    mem_baseline=$(echo "$baseline_line" | awk -F'|' '{print $4}' | tr -d ' ')

    cpu_threshold=$((cpu_baseline * 120 / 100))
    mem_threshold=$((mem_baseline * 120 / 100))

    if [ "$cpu_current" -gt "$cpu_threshold" ]; then
        echo "❌ REGRESSION: '$func' CPU cost ($cpu_current) exceeds 20% of baseline ($cpu_baseline)."
        FAILED=1
    else
        echo "✅ '$func' CPU cost is within limits ($cpu_current vs baseline $cpu_baseline)."
    fi

    if [ "$mem_current" -gt "$mem_threshold" ]; then
        echo "❌ REGRESSION: '$func' Memory cost ($mem_current) exceeds 20% of baseline ($mem_baseline)."
        FAILED=1
    else
        echo "✅ '$func' Memory cost is within limits ($mem_current vs baseline $mem_baseline)."
    fi

done < .current_bench.tmp

rm .current_bench.tmp

if [ "$FAILED" -eq 1 ]; then
    echo "🚨 Benchmark checks failed due to >20% regression."
    exit 1
fi

echo "🎉 All benchmarks passed within the 20% threshold."