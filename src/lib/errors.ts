export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function isMissingExecutableError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const maybeError = error as {
    code?: string;
    message?: string;
    shortMessage?: string;
  };

  if (maybeError.code === "ENOENT") {
    return true;
  }

  const combinedMessage = `${maybeError.shortMessage ?? ""} ${maybeError.message ?? ""}`;
  return combinedMessage.includes("ENOENT");
}
