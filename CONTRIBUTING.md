# Contributing to StellarStream

Thank you for your interest in contributing to StellarStream! This guide will help you get started with our development process.

Check out the [FAQ.md](FAQ.md) for common contributor questions and troubleshooting tips.

## Architecture Decision Records

Important architectural decisions are documented in [Architecture Decision Records (ADRs)](docs/adr/). These documents explain the rationale behind significant technical choices, including:

- [ADR 0002: Soroban Contract Integration Approach](docs/adr/0002-soroban-integration.md) - Why we use server-side signing vs. client-side signing for Soroban transactions

## Development Setup

1. Clone the repository
2. Install dependencies: `npm run install:all`
3. Run the development environment: `npm run dev`

## Testing

### Backend Tests
Run `npm run test` in the `backend/` directory.

### Contract Tests
Run `cargo test` in the `contracts/` directory.

#### Snapshot Testing
We use `insta` for snapshot testing of contract events.  
Snapshot files are located in `contracts/test_snapshots/`.

**To update snapshots:**
If you change event structures and need to update the snapshots, run:


```bash
cargo insta review
```