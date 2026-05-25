export type ResolverExecutionMessage = {
  origin: string;
  issuedAt: number;
};

export function buildResolverExecutionMessage({
  origin,
  issuedAt,
}: ResolverExecutionMessage): string {
  return [
    "SignalBond resolver execution",
    `Origin: ${origin}`,
    "Action: resolve expired signals",
    `Issued At: ${issuedAt}`,
  ].join("\n");
}
