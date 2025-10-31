// @ts-nocheck

class EnvironmentValidator {
  private static instance: EnvironmentValidator
  private validatedEnv: Environment

  private constructor() {
    this.validateEnvironment()
  }

  private validateEnvironment() {
    this.validatedEnv = {
      NODE_ENV: process.env.NODE_ENV ?? 'development',
    }
  }

  static getInstance() {
    if (!EnvironmentValidator.instance) {
      EnvironmentValidator.instance = new EnvironmentValidator()
    }
    return EnvironmentValidator.instance
  }

  getEnvironment() {
    return this.validatedEnv
  }
}

export const environmentValidator = EnvironmentValidator.getInstance()
export const envValidator = environmentValidator