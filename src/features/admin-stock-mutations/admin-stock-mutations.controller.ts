import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Validation } from '@/validations/validation';
import * as service from './admin-stock-mutations.service';
import { mutationIdSchema, mutationListSchema, mutationRequestSchema } from './admin-stock-mutations.validation';

const run = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

export const listMutations = run(async (req, res) => {
  const query = Validation.validate(mutationListSchema, req.query);
  const result = await service.listMutations(req.user, query);
  res.status(StatusCodes.OK).json(result);
});

export const requestMutation = run(async (req, res) => {
  const input = Validation.validate(mutationRequestSchema, req.body);
  const data = await service.requestMutation(req.user, input);
  res.status(StatusCodes.CREATED).json({ data });
});

export const listStores = run(async (req, res) => {
  const data = await service.listStores(req.user);
  res.status(StatusCodes.OK).json({ data });
});

export const acceptMutation = run(async (req, res) => {
  const { id } = Validation.validate(mutationIdSchema, req.params);
  const data = await service.acceptMutation(req.user, id);
  res.status(StatusCodes.OK).json({ data });
});

export const rejectMutation = run(async (req, res) => {
  const { id } = Validation.validate(mutationIdSchema, req.params);
  const data = await service.rejectMutation(req.user, id);
  res.status(StatusCodes.OK).json({ data });
});

export const shipMutation = run(async (req, res) => {
  const { id } = Validation.validate(mutationIdSchema, req.params);
  const data = await service.shipMutation(req.user, id);
  res.status(StatusCodes.OK).json({ data });
});

export const receiveMutation = run(async (req, res) => {
  const { id } = Validation.validate(mutationIdSchema, req.params);
  const data = await service.receiveMutation(req.user, id);
  res.status(StatusCodes.OK).json({ data });
});
