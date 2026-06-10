declare global {
  namespace Express {
    interface Request {
      user?: any;
      vendorId?: string;
      role?: "owner" | "assistant";
    }
  }
}

export {};