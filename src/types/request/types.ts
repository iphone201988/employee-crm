 export interface LoginRequest {
  email: string;
  password: string;
  deviceToken?: string;
  deviceType?: string;
}