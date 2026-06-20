import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import * as service from './admin-dashboard.service';

const run = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

export const getDashboard = run(async (req, res) => {
  const data = await service.getDashboard(req.user);
  res.status(StatusCodes.OK).json({ data });
});
