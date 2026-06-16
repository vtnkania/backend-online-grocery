import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Validation } from '@/validations/validation';
import * as service from './admin-inventories.service';
import { inventoryBodySchema, inventoryIdSchema, inventoryListSchema, stockUpdateSchema } from './admin-inventories.validation';

const run = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

export const listInventories = run(async (req, res) => {
  const query = Validation.validate(inventoryListSchema, req.query);
  const result = await service.listInventories(req.user, query);
  res.status(StatusCodes.OK).json(result);
});

export const createInventory = run(async (req, res) => {
  const input = Validation.validate(inventoryBodySchema, req.body);
  const data = await service.createInventory(req.user, input);
  res.status(StatusCodes.CREATED).json({ data });
});

export const updateStock = run(async (req, res) => {
  const { id } = Validation.validate(inventoryIdSchema, req.params);
  const input = Validation.validate(stockUpdateSchema, req.body);
  const data = await service.updateStock(req.user, id, input);
  res.status(StatusCodes.OK).json({ data });
});

export const deleteInventory = run(async (req, res) => {
  const { id } = Validation.validate(inventoryIdSchema, req.params);
  const result = await service.deleteInventory(id);
  res.status(StatusCodes.OK).json(result);
});

export const listMutations = run(async (req, res) => {
  const { id } = Validation.validate(inventoryIdSchema, req.params);
  const data = await service.listMutations(req.user, id);
  res.status(StatusCodes.OK).json({ data });
});
