export interface JwtPayload {
  sub: string; // userId
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
      store?: {
        id: string;
        role: string;
        isOwner: boolean;
        canManageAll: boolean;
      };
    }
  }
}

export {};