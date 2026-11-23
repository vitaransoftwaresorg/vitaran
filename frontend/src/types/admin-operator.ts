export type AdminOperator = {
  id: string;
  name: string;
  email: string;
  status: "ACTIVE" | "DISABLED";
  password: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateAdminOperatorInput = {
  name: string;
  email: string;
  password: string;
};

export type UpdateAdminOperatorInput = {
  name?: string;
  email?: string;
  password?: string;
  status?: "ACTIVE" | "DISABLED";
};
