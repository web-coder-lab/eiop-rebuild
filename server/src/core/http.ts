import type { Response } from 'express';

export function ok<T>(res: Response, data: T, requestId: string, status = 200) {
  return res.status(status).json({
    success: true,
    data,
    meta: { requestId },
  });
}
