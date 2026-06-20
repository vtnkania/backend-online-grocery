import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Validation } from '@/validations/validation';
import * as service from './admin-users.service';
import { adminUserIdSchema, adminUserListSchema, adminUserRoleSchema } from './admin-users.validation';

const run = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

export const listUsers = run(async (req, res) => {
  const query = Validation.validate(adminUserListSchema, req.query);
  const result = await service.listUsers(query);
  res.status(StatusCodes.OK).json(result);
});

export const updateUserRole = run(async (req, res) => {
  const { id } = Validation.validate(adminUserIdSchema, req.params);
  const input = Validation.validate(adminUserRoleSchema, req.body);
  const data = await service.updateUserRole(req.user, id, input.role);
  res.status(StatusCodes.OK).json({ data });
});

export const deleteUser = run(async (req, res) => {
  const { id } = Validation.validate(adminUserIdSchema, req.params);
  const result = await service.deleteUser(req.user, id);
  res.status(StatusCodes.OK).json(result);
});
