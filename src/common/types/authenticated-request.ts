import { Request } from 'express';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  isSystemAdmin: boolean;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  correlationId?: string;
}
