export const accountRoles = ['user', 'admin'] as const;
export type AccountRole = (typeof accountRoles)[number];

export interface Account {
  id: number;
  username: string;
  role: AccountRole;
}

export interface SignInRequest {
  username: string;
  password: string;
}
