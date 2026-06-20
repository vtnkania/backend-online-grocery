import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Validation } from '@/validations/validation';
import * as service from './admin-stores.service';
import { storeBodySchema, storeIdSchema, storeListSchema } from './admin-stores.validation';

const run = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

export const listStores = run(async (req, res) => {
  const query = Validation.validate(storeListSchema, req.query);
  const result = await service.listStores(req.user, query);
  res.status(StatusCodes.OK).json(result);
});

export const getStore = run(async (req, res) => {
  const { id } = Validation.validate(storeIdSchema, req.params);
  const data = await service.getStore(req.user, id);
  res.status(StatusCodes.OK).json({ data });
});

export const createStore = run(async (req, res) => {
  const input = Validation.validate(storeBodySchema, req.body);
  const data = await service.createStore(req.user, input);
  res.status(StatusCodes.CREATED).json({ data });
});

export const updateStore = run(async (req, res) => {
  const { id } = Validation.validate(storeIdSchema, req.params);
  const input = Validation.validate(storeBodySchema, req.body);
  const data = await service.updateStore(req.user, id, input);
  res.status(StatusCodes.OK).json({ data });
});

export const deleteStore = run(async (req, res) => {
  const { id } = Validation.validate(storeIdSchema, req.params);
  const result = await service.deleteStore(req.user, id);
  res.status(StatusCodes.OK).json(result);
});

export const listManagers = run(async (req, res) => {
  const data = await service.listManagers(req.user);
  res.status(StatusCodes.OK).json({ data });
});
