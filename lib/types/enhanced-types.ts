/**
 * Enhanced Type System for DirectoryBolt
 * Implements 2025 TypeScript best practices for maximum type safety
 * Provides branded types, strict validation, and runtime type checking
 */

// Branded types for better type safety
export type Brand<T, K> = T & { readonly __brand: K };

// Core branded types
export type UserId = Brand<string, 'UserId'>;
export type OrganizationId = Brand<string, 'OrganizationId'>;
export type DirectoryId = Brand<string, 'DirectoryId'>;
export type SubmissionId = Brand<string, 'SubmissionId'>;
export type APIKey = Brand<string, 'APIKey'>;
export type Email = Brand<string, 'Email'>;
export type URL = Brand<string, 'URL'>;
export type PhoneNumber = Brand<string, 'PhoneNumber'>;

// Utility types for better type safety
export type NonEmptyArray<T> = [T, ...T[]];
export type NonEmptyString = Brand<string, 'NonEmptyString'>;
export type PositiveNumber = Brand<number, 'PositiveNumber'>;
export type NonNegativeNumber = Brand<number, 'NonNegativeNumber'>;

// Result type for error handling
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

// Option type for nullable values
export type Option<T> = T | null | undefined;
export type Some<T> = NonNullable<T>;
export type None = null | undefined;

// Enhanced user types
export interface StrictUser {
  readonly id: UserId;
  readonly email: Email;
  readonly organizationId: Option<OrganizationId>;
  readonly tier: UserTier;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export const USER_TIERS = ['free', 'basic', 'premium', 'enterprise'] as const;
export type UserTier = typeof USER_TIERS[number];

// Enhanced directory types
export interface StrictDirectory {
  readonly id: DirectoryId;
  readonly name: NonEmptyString;
  readonly url: URL;
  readonly tier: DirectoryTier;
  readonly category: DirectoryCategory;
  readonly requirements: Readonly<DirectoryRequirements>;
  readonly metadata: Readonly<DirectoryMetadata>;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export const DIRECTORY_TIERS = ['free', 'basic', 'premium', 'enterprise'] as const;
export type DirectoryTier = typeof DIRECTORY_TIERS[number];

export const DIRECTORY_CATEGORIES = [
  'general',
  'tech',
  'startup',
  'business',
  'local',
  'niche',
  'industry-specific'
] as const;
export type DirectoryCategory = typeof DIRECTORY_CATEGORIES[number];

export interface DirectoryRequirements {
  readonly hasBusinessVerification: boolean;
  readonly requiresPayment: boolean;
  readonly minimumDomainAge: Option<PositiveNumber>;
  readonly requiresContact: boolean;
  readonly customFields: Readonly<CustomField[]>;
}

export interface CustomField {
  readonly id: string;
  readonly name: NonEmptyString;
  readonly type: FieldType;
  readonly required: boolean;
  readonly validation: Option<ValidationRule>;
}

export const FIELD_TYPES = ['text', 'email', 'url', 'phone', 'number', 'select', 'textarea'] as const;
export type FieldType = typeof FIELD_TYPES[number];

export interface ValidationRule {
  readonly pattern: Option<string>;
  readonly min: Option<number>;
  readonly max: Option<number>;
  readonly options: Option<ReadonlyArray<string>>;
}

export interface DirectoryMetadata {
  readonly submissionUrl: URL;
  readonly approvalTime: Option<PositiveNumber>; // in hours
  readonly successRate: Option<NonNegativeNumber>; // 0-100
  readonly lastUpdated: Date;
  readonly tags: ReadonlyArray<string>;
}

// Enhanced submission types
export interface StrictSubmission {
  readonly id: SubmissionId;
  readonly userId: UserId;
  readonly directoryId: DirectoryId;
  readonly status: SubmissionStatus;
  readonly data: Readonly<SubmissionData>;
  readonly result: Option<SubmissionResult>;
  readonly attempts: ReadonlyArray<SubmissionAttempt>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export const SUBMISSION_STATUSES = [
  'pending',
  'processing',
  'submitted',
  'approved',
  'rejected',
  'failed',
  'retry'
] as const;
export type SubmissionStatus = typeof SUBMISSION_STATUSES[number];

export interface SubmissionData {
  readonly businessName: NonEmptyString;
  readonly businessDescription: NonEmptyString;
  readonly websiteUrl: URL;
  readonly contactEmail: Email;
  readonly contactPhone: Option<PhoneNumber>;
  readonly category: DirectoryCategory;
  readonly customFields: Readonly<Record<string, unknown>>;
}

export interface SubmissionResult {
  readonly success: boolean;
  readonly message: Option<string>;
  readonly submissionUrl: Option<URL>;
  readonly approvalUrl: Option<URL>;
  readonly estimatedApprovalTime: Option<PositiveNumber>;
}

export interface SubmissionAttempt {
  readonly id: string;
  readonly timestamp: Date;
  readonly status: SubmissionStatus;
  readonly error: Option<string>;
  readonly response: Option<unknown>;
}

// API Response types
export interface APIResponse<T> {
  readonly success: boolean;
  readonly data: Option<T>;
  readonly error: Option<APIError>;
  readonly metadata: Option<APIMetadata>;
}

export interface APIError {
  readonly code: string;
  readonly message: NonEmptyString;
  readonly details: Option<Record<string, unknown>>;
  readonly timestamp: Date;
}

export interface APIMetadata {
  readonly requestId: string;
  readonly timestamp: Date;
  readonly version: string;
  readonly rateLimit: Option<RateLimitInfo>;
}

export interface RateLimitInfo {
  readonly limit: PositiveNumber;
  readonly remaining: NonNegativeNumber;
  readonly resetTime: Date;
}

// Feature flag types
export interface FeatureFlagConfig {
  readonly key: NonEmptyString;
  readonly enabled: boolean;
  readonly rolloutPercentage: NonNegativeNumber; // 0-100
  readonly targeting: Option<FeatureFlagTargeting>;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface FeatureFlagTargeting {
  readonly users: Option<ReadonlyArray<UserId>>;
  readonly organizations: Option<ReadonlyArray<OrganizationId>>;
  readonly tiers: Option<ReadonlyArray<UserTier>>;
  readonly environment: Option<Environment>;
}

export const ENVIRONMENTS = ['development', 'staging', 'production'] as const;
export type Environment = typeof ENVIRONMENTS[number];

// Type guards and validators
export const isNonEmptyString = (value: unknown): value is NonEmptyString => {
  return typeof value === 'string' && value.length > 0;
};

export const isValidEmail = (value: string): value is Email => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
};

export const isValidURL = (value: string): value is URL => {
  try {
    new globalThis.URL(value);
    return true;
  } catch {
    return false;
  }
};

export const isPositiveNumber = (value: number): value is PositiveNumber => {
  return Number.isFinite(value) && value > 0;
};

export const isNonNegativeNumber = (value: number): value is NonNegativeNumber => {
  return Number.isFinite(value) && value >= 0;
};

export const isUserTier = (value: string): value is UserTier => {
  return USER_TIERS.includes(value as UserTier);
};

export const isDirectoryTier = (value: string): value is DirectoryTier => {
  return DIRECTORY_TIERS.includes(value as DirectoryTier);
};

export const isDirectoryCategory = (value: string): value is DirectoryCategory => {
  return DIRECTORY_CATEGORIES.includes(value as DirectoryCategory);
};

export const isSubmissionStatus = (value: string): value is SubmissionStatus => {
  return SUBMISSION_STATUSES.includes(value as SubmissionStatus);
};

export const isFieldType = (value: string): value is FieldType => {
  return FIELD_TYPES.includes(value as FieldType);
};

export const isEnvironment = (value: string): value is Environment => {
  return ENVIRONMENTS.includes(value as Environment);
};

// Runtime validation functions
export const validateUser = (user: unknown): Result<StrictUser> => {
  if (!user || typeof user !== 'object') {
    return { success: false, error: new Error('User must be an object') };
  }

  const u = user as Record<string, unknown>;

  if (!isNonEmptyString(u.id)) {
    return { success: false, error: new Error('User ID must be a non-empty string') };
  }

  if (!isValidEmail(String(u.email))) {
    return { success: false, error: new Error('User email must be valid') };
  }

  if (u.tier && !isUserTier(String(u.tier))) {
    return { success: false, error: new Error('User tier must be valid') };
  }

  // Additional validation would go here...

  return {
    success: true,
    data: user as StrictUser
  };
};

export const validateDirectory = (directory: unknown): Result<StrictDirectory> => {
  if (!directory || typeof directory !== 'object') {
    return { success: false, error: new Error('Directory must be an object') };
  }

  const d = directory as Record<string, unknown>;

  if (!isNonEmptyString(d.id)) {
    return { success: false, error: new Error('Directory ID must be a non-empty string') };
  }

  if (!isNonEmptyString(d.name)) {
    return { success: false, error: new Error('Directory name must be a non-empty string') };
  }

  if (!isValidURL(String(d.url))) {
    return { success: false, error: new Error('Directory URL must be valid') };
  }

  // Additional validation would go here...

  return {
    success: true,
    data: directory as StrictDirectory
  };
};

// Utility functions for working with branded types
export const createUserId = (id: string): Result<UserId> => {
  if (!isNonEmptyString(id)) {
    return { success: false, error: new Error('User ID must be a non-empty string') };
  }
  return { success: true, data: (id as unknown) as UserId };
};

export const createEmail = (email: string): Result<Email> => {
  if (!isValidEmail(email)) {
    return { success: false, error: new Error('Email must be valid') };
  }
  return { success: true, data: email as Email };
};

export const createURL = (url: string): Result<URL> => {
  if (!isValidURL(url)) {
    return { success: false, error: new Error('URL must be valid') };
  }
  return { success: true, data: url as URL };
};

export const createPositiveNumber = (num: number): Result<PositiveNumber> => {
  if (!isPositiveNumber(num)) {
    return { success: false, error: new Error('Number must be positive') };
  }
  return { success: true, data: num as PositiveNumber };
};

// Helper types for API endpoints
export type EndpointHandler<TRequest, TResponse> = (
  req: TRequest
) => Promise<APIResponse<TResponse>>;

export type AuthenticatedEndpointHandler<TRequest, TResponse> = (
  req: TRequest,
  user: StrictUser
) => Promise<APIResponse<TResponse>>;

// Export everything as const assertions for better type inference
export const TypedDirectoryBolt = {
  USER_TIERS,
  DIRECTORY_TIERS,
  DIRECTORY_CATEGORIES,
  SUBMISSION_STATUSES,
  FIELD_TYPES,
  ENVIRONMENTS,
  isNonEmptyString,
  isValidEmail,
  isValidURL,
  isPositiveNumber,
  isNonNegativeNumber,
  isUserTier,
  isDirectoryTier,
  isDirectoryCategory,
  isSubmissionStatus,
  isFieldType,
  isEnvironment,
  validateUser,
  validateDirectory,
  createUserId,
  createEmail,
  createURL,
  createPositiveNumber
} as const;