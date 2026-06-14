declare global {
  namespace Express {
    interface UserPayload {
      id: string;
      role: string;
      isVerified: boolean;
    }

    interface Request {
      user?: UserPayload;
    }
  }
}

export {};
