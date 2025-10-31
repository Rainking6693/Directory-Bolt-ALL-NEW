/**
 * Google Sheets Service - Deprecated Stub
 * ======================================
 * This is a compatibility stub for the old Google Sheets integration.
 * All functionality has been migrated to Supabase.
 * 
 * This file exists only to prevent build errors in legacy code.
 * New implementations should use the Supabase service directly.
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Legacy Google Sheets API - Redirected to Supabase
 * 
 * @deprecated Use Supabase service directly instead
 */
class GoogleSheetsService {
  constructor() {
    console.warn('[DEPRECATED] GoogleSheetsService is deprecated. Use Supabase service directly.');
    this.migrationNotice();
  }

  migrationNotice() {
    console.log(`
🚨 MIGRATION NOTICE
==================
Google Sheets integration has been replaced with Supabase.
All data operations now use the Supabase database.

For new implementations, use:
- lib/services/supabase-service.js
- Direct Supabase client calls

This compatibility layer will be removed in future versions.
    `);
  }

  // Legacy compatibility methods that redirect to Supabase
  async getCustomers() {
    console.warn('[DEPRECATED] getCustomers() - Use Supabase directly');
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Convert Supabase format to legacy Google Sheets format
      return data.map(customer => ({
        'Customer ID': customer.customer_id,
        'Business Name': customer.business_name,
        'Email': customer.email,
        'Phone': customer.phone,
        'Website': customer.website,
        'Package Type': customer.package_type,
        'Status': customer.status,
        'Created Date': customer.created_at,
        'Updated Date': customer.updated_at
      }));
    } catch (error) {
      console.error('[DEPRECATED] GoogleSheetsService.getCustomers error:', error);
      return [];
    }
  }

  async addCustomer(customerData) {
    console.warn('[DEPRECATED] addCustomer() - Use Supabase directly');
    try {
      // Convert legacy format to Supabase format
      const supabaseData = {
        customer_id: customerData['Customer ID'] || this.generateCustomerID(),
        business_name: customerData['Business Name'] || customerData.business_name,
        email: customerData['Email'] || customerData.email,
        phone: customerData['Phone'] || customerData.phone,
        website: customerData['Website'] || customerData.website,
        package_type: customerData['Package Type'] || customerData.package_type || 'starter',
        status: customerData['Status'] || customerData.status || 'active'
      };

      const { data, error } = await supabase
        .from('customers')
        .insert([supabaseData])
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('[DEPRECATED] GoogleSheetsService.addCustomer error:', error);
      throw error;
    }
  }

  async updateCustomer(customerId, updates) {
    console.warn('[DEPRECATED] updateCustomer() - Use Supabase directly');
    try {
      const { data, error } = await supabase
        .from('customers')
        .update(updates)
        .eq('customer_id', customerId)
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('[DEPRECATED] GoogleSheetsService.updateCustomer error:', error);
      throw error;
    }
  }

  async findCustomer(query) {
    console.warn('[DEPRECATED] findCustomer() - Use Supabase directly');
    try {
      let supabaseQuery = supabase.from('customers').select('*');

      // Handle different query types
      if (typeof query === 'string') {
        // Assume it's a customer ID or email
        supabaseQuery = supabaseQuery.or(`customer_id.eq.${query},email.eq.${query}`);
      } else if (typeof query === 'object') {
        // Handle object-based queries
        Object.keys(query).forEach(key => {
          supabaseQuery = supabaseQuery.eq(key, query[key]);
        });
      }

      const { data, error } = await supabaseQuery;
      if (error) throw error;

      return data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('[DEPRECATED] GoogleSheetsService.findCustomer error:', error);
      return null;
    }
  }

  async deleteCustomer(customerId) {
    console.warn('[DEPRECATED] deleteCustomer() - Use Supabase directly');
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('customer_id', customerId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[DEPRECATED] GoogleSheetsService.deleteCustomer error:', error);
      throw error;
    }
  }

  async getCustomerStats() {
    console.warn('[DEPRECATED] getCustomerStats() - Use Supabase directly');
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('status, package_type, created_at');

      if (error) throw error;

      // Calculate stats from Supabase data
      const stats = {
        total: data.length,
        active: data.filter(c => c.status === 'active').length,
        pending: data.filter(c => c.status === 'pending').length,
        completed: data.filter(c => c.status === 'completed').length,
        by_package: {},
        recent: data.filter(c => {
          const created = new Date(c.created_at);
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return created > sevenDaysAgo;
        }).length
      };

      // Count by package type
      data.forEach(customer => {
        const pkg = customer.package_type || 'unknown';
        stats.by_package[pkg] = (stats.by_package[pkg] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('[DEPRECATED] GoogleSheetsService.getCustomerStats error:', error);
      return {
        total: 0,
        active: 0,
        pending: 0,
        completed: 0,
        by_package: {},
        recent: 0
      };
    }
  }

  generateCustomerID() {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return `DIR-${dateStr}-${randomNum}`;
  }

  // Legacy authentication methods (no-op for compatibility)
  async authenticate() {
    console.warn('[DEPRECATED] authenticate() - No longer needed with Supabase');
    return true;
  }

  async isAuthenticated() {
    console.warn('[DEPRECATED] isAuthenticated() - No longer needed with Supabase');
    return true;
  }

  // Batch operations
  async batchUpdate(updates) {
    console.warn('[DEPRECATED] batchUpdate() - Use Supabase directly');
    try {
      const results = [];
      for (const update of updates) {
        const result = await this.updateCustomer(update.customer_id, update.data);
        results.push(result);
      }
      return results;
    } catch (error) {
      console.error('[DEPRECATED] GoogleSheetsService.batchUpdate error:', error);
      throw error;
    }
  }

  async batchInsert(customers) {
    console.warn('[DEPRECATED] batchInsert() - Use Supabase directly');
    try {
      const results = [];
      for (const customer of customers) {
        const result = await this.addCustomer(customer);
        results.push(result);
      }
      return results;
    } catch (error) {
      console.error('[DEPRECATED] GoogleSheetsService.batchInsert error:', error);
      throw error;
    }
  }

  // Spreadsheet management methods (no-op for compatibility)
  async createSpreadsheet(name) {
    console.warn('[DEPRECATED] createSpreadsheet() - Not needed with Supabase');
    return { id: 'supabase', name: 'Supabase Database' };
  }

  async getSpreadsheetInfo() {
    console.warn('[DEPRECATED] getSpreadsheetInfo() - Not needed with Supabase');
    return {
      id: 'supabase',
      name: 'DirectoryBolt Supabase Database',
      url: process.env.NEXT_PUBLIC_SUPABASE_URL
    };
  }

  async getWorksheets() {
    console.warn('[DEPRECATED] getWorksheets() - Not needed with Supabase');
    return [
      { id: 'customers', title: 'Customers' },
      { id: 'queue_history', title: 'Queue History' },
      { id: 'customer_notifications', title: 'Notifications' }
    ];
  }

  // Error handling
  handleError(error) {
    console.error('[DEPRECATED] GoogleSheetsService error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
      migrated_to_supabase: true
    };
  }

  // Health check
  async healthCheck() {
    console.warn('[DEPRECATED] healthCheck() - Checking Supabase instead');
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('count', { count: 'exact', head: true });

      return {
        status: error ? 'error' : 'healthy',
        service: 'supabase',
        deprecated_service: 'google_sheets',
        migration_complete: !error
      };
    } catch (error) {
      return {
        status: 'error',
        service: 'supabase',
        deprecated_service: 'google_sheets',
        error: error.message
      };
    }
  }
}

// Export both class and instance for compatibility
const googleSheetsService = new GoogleSheetsService();

module.exports = {
  GoogleSheetsService,
  googleSheetsService,
  default: googleSheetsService,
  
  // Critical missing function that was causing the 500 error
  createGoogleSheetsService: () => new GoogleSheetsService(),
  
  // Direct function exports for compatibility
  getCustomers: () => googleSheetsService.getCustomers(),
  addCustomer: (data) => googleSheetsService.addCustomer(data),
  updateCustomer: (id, updates) => googleSheetsService.updateCustomer(id, updates),
  findCustomer: (query) => googleSheetsService.findCustomer(query),
  deleteCustomer: (id) => googleSheetsService.deleteCustomer(id),
  getCustomerStats: () => googleSheetsService.getCustomerStats(),
  generateCustomerID: () => googleSheetsService.generateCustomerID(),
  
  // Migration utilities
  getMigrationStatus: () => ({
    google_sheets_deprecated: true,
    supabase_active: true,
    migration_date: '2025-09-18',
    compatibility_layer: true
  })
};

// Log deprecation warning when module is loaded
console.log('🔄 Google Sheets compatibility layer loaded - redirecting to Supabase');