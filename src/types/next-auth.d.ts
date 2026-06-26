import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role: "EMPLOYEE" | "MANAGER" | "HR";
    departmentId: string | null;
  }

  interface Session {
    user: {
      userId: string;
      email: string;
      role: "EMPLOYEE" | "MANAGER" | "HR";
      departmentId: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    role: "EMPLOYEE" | "MANAGER" | "HR";
    departmentId: string | null;
  }
}
