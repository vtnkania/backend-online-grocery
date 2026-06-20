import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Validation } from '@/validations/validation';
import * as service from './admin-categories.service';
import { categoryBodySchema, categoryIdSchema, categoryListSchema } from './admin-categories.validation';

const run = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

export const listCategories = run(async (req, res) => {
  const query = Validation.validate(categoryListSchema, req.query);
  const result = await service.listCategories(req.user, query);
  res.status(StatusCodes.OK).json(result);
});

export const createCategory = run(async (req, res) => {
  const input = Validation.validate(categoryBodySchema, req.body);
  const data = await service.createCategory(req.user, input);
  res.status(StatusCodes.CREATED).json({ data });
});

export const updateCategory = run(async (req, res) => {
  const { id } = Validation.validate(categoryIdSchema, req.params);
  const input = Validation.validate(categoryBodySchema, req.body);
  const data = await service.updateCategory(req.user, id, input);
  res.status(StatusCodes.OK).json({ data });
});

export const deleteCategory = run(async (req, res) => {
  const { id } = Validation.validate(categoryIdSchema, req.params);
  const result = await service.deleteCategory(req.user, id);
  res.status(StatusCodes.OK).json(result);
});
