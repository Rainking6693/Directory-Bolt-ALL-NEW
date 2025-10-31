export interface TestCustomer {
  id: string;
  firstName: string;
  lastName: string;
  businessName: string;
  email: string;
  phone?: string | null;
  website?: string | null;
  packageType?: string;
  directoryLimit?: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

const GLOBAL_KEY = '__DIRECTORYBOLT_TEST_CUSTOMERS__';

const buildSeedCustomer = (): TestCustomer => {
  const timestamp = new Date().toISOString();
  return {
    id: 'test-customer-ben',
    firstName: 'Ben',
    lastName: 'Stone',
    businessName: 'DirectoryBolt Test Customer',
    email: 'rainking6693@gmail.com',
    phone: null,
    website: null,
    packageType: 'STARTER',
    directoryLimit: 25,
    status: 'pending',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const ensureStore = (): Map<string, TestCustomer> => {
  const globalAny = globalThis as Record<string, unknown>;
  if (!globalAny[GLOBAL_KEY]) {
    const store = new Map<string, TestCustomer>();
    store.set('test-customer-ben', buildSeedCustomer());
    globalAny[GLOBAL_KEY] = store;
  }
  return globalAny[GLOBAL_KEY] as Map<string, TestCustomer>;
};

export const getTestCustomerStore = (): Map<string, TestCustomer> => ensureStore();

export const upsertTestCustomer = (customer: TestCustomer): TestCustomer => {
  const store = ensureStore();
  const record = {
    ...customer,
    createdAt: customer.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.set(record.id, record);
  return record;
};

export const findTestCustomer = (id: string): TestCustomer | undefined => {
  const store = ensureStore();
  return store.get(id);
};

export const listTestCustomers = (): TestCustomer[] => {
  const store = ensureStore();
  return Array.from(store.values());
};
