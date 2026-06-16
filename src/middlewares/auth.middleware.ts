import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response.error';
import { verifyAccessToken } from '@/features/auth/auth.service';

const bearerToken = (header?: string) => {
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7);
};

export const authenticateUser = async (req: Request, _: Response, next: NextFunction) => {
  try {
    const token = bearerToken(req.headers.authorization);
    if (!token) throw new ResponseError(StatusCodes.UNAUTHORIZED, 'Authentication required.');
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || user.deletedAt) throw new ResponseError(StatusCodes.UNAUTHORIZED, 'Invalid session.');
    req.user = { id: user.id, role: user.role, isVerified: user.isVerified };
    next();
  } catch (error) {
    next(error instanceof ResponseError ? error : new ResponseError(StatusCodes.UNAUTHORIZED, 'Invalid session.'));
  }
};

export const requireVerifiedUser = (req: Request, _: Response, next: NextFunction) => {
  if (!req.user?.isVerified) {
    next(new ResponseError(StatusCodes.FORBIDDEN, 'Please verify your email first.'));
    return;
  }
  next();
};

export const requireRole = (...roles: string[]) => (req: Request, _: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) {
    next(new ResponseError(StatusCodes.FORBIDDEN, 'You are not allowed to access this resource.'));
    return;
  }
  next();
};
