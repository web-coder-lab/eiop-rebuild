export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly expose = true,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorPayload(error: unknown, requestId: string) {
  if (error instanceof AppError) {
    return {
      success: false as const,
      error: { code: error.code, message: error.message },
      meta: { requestId },
    };
  }
  return {
    success: false as const,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
    meta: { requestId },
  };
}

export function statusOf(error: unknown) {
  return error instanceof AppError ? error.status : 500;
}
