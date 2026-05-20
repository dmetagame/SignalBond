import type { Address, Hex } from "viem";

export const arcExplorerBaseUrl = "https://testnet.arcscan.app";

export function arcTxUrl(hash: Hex): string {
  return `${arcExplorerBaseUrl}/tx/${hash}`;
}

export function arcAddressUrl(address: Address): string {
  return `${arcExplorerBaseUrl}/address/${address}`;
}
