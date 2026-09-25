import { AppError } from './errors.js';

export function assertOwner(resourceUserId: string | undefined, actorUserId: string | undefined) {
  if (!actorUserId) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  if (!resourceUserId || resourceUserId !== actorUserId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have access to this resource.');
  }
}

export function pickActorId(bodyUserId: unknown, authUserId: string) {
  if (bodyUserId && String(bodyUserId) !== authUserId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have access to this resource.');
  }
  return authUserId;
}
