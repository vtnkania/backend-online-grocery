import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Validation } from '@/validations/validation';
import * as service from './admin-products.service';
import { productBodySchema, productIdSchema, productListSchema, productUpdateSchema } from './admin-products.validation';

const run = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

const files = (req: Request) => (Array.isArray(req.files) ? req.files : []);

export const listProducts = run(async (req, res) => {
  const query = Validation.validate(productListSchema, req.query);
  const result = await service.listProducts(req.user, query);
  res.status(StatusCodes.OK).json(result);
});

export const getProduct = run(async (req, res) => {
  const { id } = Validation.validate(productIdSchema, req.params);
  const data = await service.getProduct(req.user, id);
  res.status(StatusCodes.OK).json({ data });
});

export const createProduct = run(async (req, res) => {
  const input = Validation.validate(productBodySchema, req.body);
  const data = await service.createProduct(req.user, input, files(req));
  res.status(StatusCodes.CREATED).json({ data });
});

export const updateProduct = run(async (req, res) => {
  const { id } = Validation.validate(productIdSchema, req.params);
  const input = Validation.validate(productUpdateSchema, req.body);
  const data = await service.updateProduct(id, input, files(req));
  res.status(StatusCodes.OK).json({ data });
});

export const deleteProduct = run(async (req, res) => {
  const { id } = Validation.validate(productIdSchema, req.params);
  const result = await service.deleteProduct(id);
  res.status(StatusCodes.OK).json(result);
});

export const getProductOptions = run(async (req, res) => {
  const data = await service.getProductOptions(req.user);
  res.status(StatusCodes.OK).json({ data });
});
