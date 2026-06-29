/**
 * Soroban / on-chain interactions for the StellarStream frontend.
 *
 * For detailed TypeScript usage examples of the generated contract client,
 * see: docs/CONTRACT_BINDINGS.md
 *
 * `claimStream` calls the backend `/api/streams/:id/claim` endpoint which
 * builds, signs (fee-sponsored), and submits the Soroban `claim` transaction
 * on behalf of the recipient.  The backend returns the claimed amount and the
 * updated event history.
 *
 * To use the generated contract client directly (for read operations or
 * wallet-signed transactions), import from `./contractClient`.
 */

import { getAuthToken } from "./api";
import type { StreamEvent } from "./api";
import { CONTRACT_ID, RPC_URL, NETWORK_PASSPHRASE } from "./contractClient";

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? "/api";

export interface ClaimResult {
  /** Amount of tokens transferred to the recipient in this claim. */
  claimedAmount: number;
  /** Asset code of the claimed tokens. */
  assetCode: string;
  /** Stellar transaction hash confirming the on-chain claim. */
  txHash: string;
}

export interface ClaimResponse {
  result: ClaimResult;
  history: StreamEvent[];
}

export class SorobanClaimError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "SorobanClaimError";
    this.code = code;
  }
}

/**
 * Claim vested tokens from a stream.
 *
 * @param streamId       - Numeric stream ID.
 * @param recipientAddress - Stellar public key of the recipient (must match stream).
 * @param amount         - Claimable amount as reported by the backend (for display only;
 *                         the contract determines the actual claimable amount on-chain).
 */
export async function claimOnChain(
  streamId: string,
  recipientAddress: string,
  amount: number,
): Promise<ClaimResponse> {
  const token = getAuthToken();

  const response = await fetch(`${API_BASE}/streams/${streamId}/claim`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ recipientAddress, amount }),
  });

  if (!response.ok) {
    let message = `Claim failed (${response.status})`;
    let code = "UNKNOWN";
    try {
      const body = (await response.json()) as { error?: string; code?: string };
      if (body.error) message = body.error;
      if (body.code) code = body.code;
    } catch {
      // ignore JSON parse errors
    }
    throw new SorobanClaimError(message, code);
  }

  return response.json() as Promise<ClaimResponse>;
}

export const claimStream = claimOnChain;

export interface ClaimableBatchResponse {
  amounts: Record<string, number>;
  at: number;
}

/**
 * Simulate on-chain claimable amounts for multiple streams via get_claimable_batch.
 * Maximum 20 stream IDs per request (Soroban contract limit).
 */
export async function getClaimableBatch(
  streamIds: string[],
): Promise<ClaimableBatchResponse> {
  const token = getAuthToken();

  const response = await fetch(`${API_BASE}/streams/claimable/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ streamIds }),
  });

  if (!response.ok) {
    let message = `Failed to fetch claimable batch (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message);
  }

  return response.json() as Promise<ClaimableBatchResponse>;
}

