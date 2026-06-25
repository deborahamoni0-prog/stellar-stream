// Import the generated contract client (will be available after running npm run gen:bindings)
// import { Contract } from "../contracts/generated";

const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID ?? "";
const RPC_URL =
  import.meta.env.VITE_RPC_URL ?? "https://soroban-testnet.stellar.org:443";
const NETWORK_PASSPHRASE =
  import.meta.env.VITE_NETWORK_PASSPHRASE ??
  "Test SDF Network ; September 2015";

// Create the contract client (uncomment once bindings are generated)
// export const streamContract = new Contract({
//   contractId: CONTRACT_ID,
//   rpcUrl: RPC_URL,
//   networkPassphrase: NETWORK_PASSPHRASE,
// });

// Export config values for other uses
export { CONTRACT_ID, RPC_URL, NETWORK_PASSPHRASE };
