export const ENV_SCOPE_VALUES = ["root", "all", "packages"] as const;

export type EnvScope = (typeof ENV_SCOPE_VALUES)[number];

export function parseOptionalEnvScope(
  value: string | undefined,
  source: string,
): EnvScope | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (isEnvScope(normalized)) {
    return normalized;
  }

  throw new Error(
    `Invalid ${source}: "${value}". Expected one of: ${ENV_SCOPE_VALUES.join(", ")}.`,
  );
}

function isEnvScope(value: string): value is EnvScope {
  return (ENV_SCOPE_VALUES as readonly string[]).includes(value);
}
