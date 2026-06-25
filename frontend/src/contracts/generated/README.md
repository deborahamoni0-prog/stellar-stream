# Generated Contract Bindings

This directory contains TypeScript bindings generated from the deployed StellarStream Soroban contract.

## How to regenerate

Run the following command from the project root:

```bash
CONTRACT_ID="C..." npm run gen:bindings
```

Or if you have a saved `contracts/contract_id.txt`:

```bash
CONTRACT_ID=$(cat contracts/contract_id.txt) npm run gen:bindings
```

For more details, see [docs/CONTRACT_BINDINGS.md](../../../../docs/CONTRACT_BINDINGS.md)
