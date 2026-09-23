export class HttpError extends Error {
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, HttpError);
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, message, details);

export const unauthorized = (message = 'Non autorisé') => new HttpError(401, message);

export const forbidden = (message = 'Accès refusé') => new HttpError(403, message);

export const notFound = (message = 'Introuvable') => new HttpError(404, message);

export const conflict = (message = 'Conflit') => new HttpError(409, message);

export const tooManyRequests = (message = 'Trop de requêtes') => new HttpError(429, message);

export const badGateway = (message = 'Service externe indisponible') => new HttpError(502, message);