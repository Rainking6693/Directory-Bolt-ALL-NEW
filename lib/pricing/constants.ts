export const TRIAL_DAYS = 14
export const MONEY_BACK_DAYS = 30
export const TRIAL_LABEL = `${TRIAL_DAYS}-day free trial`
export const MONEY_BACK_LABEL = `${MONEY_BACK_DAYS}-day money-back guarantee`

export const HERO_VALUE = 4300
export const HERO_ONE_TIME_PRICE = 299
export const PRICE_START = 149
export const PRICE_MAX = 799

export function formatCurrency(value: number) {
  return `$${value.toLocaleString('en-US')}`
}
