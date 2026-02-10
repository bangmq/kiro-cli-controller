export interface AuthStatus {
  loading: boolean;
  error: string | null;
  loggedIn: boolean;
  user: string | null;
  actionLoading: boolean;
  actionError: string | null;
}
