
export async function getFunctionErrorMessage(
  error: unknown,
  fallback: string,
): Promise<string> {
  if (error && typeof error === "object" && "context" in error) {
    const context = error.context;

    if (context instanceof Response) {
      try {
        const payload = await context.clone().json();

        if (
          payload &&
          typeof payload.error === "string" &&
          payload.error.trim()
        ) {
          return payload.error;
        }

        if (
          payload &&
          typeof payload.message === "string" &&
          payload.message.trim()
        ) {
          return payload.message;
        }
      } catch {
        // La réponse ne contient pas nécessairement du JSON.
      }

      if (context.status === 429) {
        return "Trop de tentatives. Réessaie dans 15 minutes.";
      }
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}


export async function getFunctionRetryAfterSeconds(
  error: unknown,
): Promise<number | null> {
  if (!error || typeof error !== "object" || !("context" in error)) {
    return null;
  }

  const context = error.context;

  if (!(context instanceof Response)) {
    return null;
  }

  try {
    const payload = await context.clone().json();

    const seconds = Number(payload?.retry_after_seconds);

    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.ceil(seconds);
    }
  } catch {
    // Réponse non JSON.
  }

  const headerSeconds = Number(context.headers.get("Retry-After"));

  if (Number.isFinite(headerSeconds) && headerSeconds > 0) {
    return Math.ceil(headerSeconds);
  }

  return null;
}

