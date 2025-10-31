export interface SupabaseServerConfig {
  url: string;
  serviceRoleKey: string;
}

export interface SupabasePublicConfig {
  url: string;
  anonKey: string;
}

export function getSupabaseServerConfig(): SupabaseServerConfig;
export function getSupabasePublicConfig(): SupabasePublicConfig;
