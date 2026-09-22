import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import * as appointmentService from '../services/appointment.service';

export const listAppointments = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const result = await appointmentService.listAppointments(req.store.id, {
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
    status: req.query.status as string | undefined,
    mechanicId: req.query.mechanicId as string | undefined,
    customerId: req.query.customerId as string | undefined,
  });
  res.json(result);
});

export const getAppointment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const appointment = await appointmentService.getAppointment(req.store.id, req.params.appointmentId);
  res.json(appointment);
});

export const createAppointment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store || !req.user) throw badRequest('Contexte boutique manquant');
  const appointment = await appointmentService.createAppointment(req.store.id, req.user.id, req.body);
  res.status(201).json(appointment);
});

export const updateAppointment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const appointment = await appointmentService.updateAppointment(req.store.id, req.params.appointmentId, req.body);
  res.json(appointment);
});

export const changeStatus = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const appointment = await appointmentService.setAppointmentStatus(
    req.store.id,
    req.params.appointmentId,
    req.body.status
  );
  res.json(appointment);
});

export const deleteAppointment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  await appointmentService.deleteAppointment(req.store.id, req.params.appointmentId);
  res.status(204).end();
});