// Comprehensive Integration Test Suite for DirectoryBolt
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import request from 'supertest'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// Test configuration
const TEST_CONFIG = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
  baseUrl: process.env.BASE_URL || 'http://localhost:3000'
}

// Test utilities
class TestUtils {
  static supabase = createClient(TEST_CONFIG.supabaseUrl, TEST_CONFIG.supabaseKey)
  static stripe = new Stripe(TEST_CONFIG.stripeSecretKey, { apiVersion: '2023-08-16' })

  // Create test customer data
  static createTestCustomer() {
    const timestamp = Date.now()
    return {
      email: `test.customer.${timestamp}@directorybolt.test`,
      firstName: 'Test',
      lastName: 'Customer',
      business_name: `Test Business ${timestamp}`,
      business_website: 'https://testbusiness.com',
      business_phone: '+1234567890',
      business_address: '123 Test Street',
      business_city: 'Test City',
      business_state: 'Test State',
      business_zip: '12345',
      business_description: 'A test business for testing purposes',
      business_category: 'Technology',
      package_type: 'growth' as const
    }
  }

  // Create test Stripe session
  static async createTestStripeSession(customerEmail: string) {
    return await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'DirectoryBolt Growth Package' },
          unit_amount: 29900
        },
        quantity: 1
      }],
      mode: 'payment',
      customer_email: customerEmail,
      success_url: `${TEST_CONFIG.baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${TEST_CONFIG.baseUrl}/pricing`
    })
  }

  // Clean up test data
  static async cleanupTestData(email: string) {
    // Delete customer records
    await this.supabase
      .from('customers')
      .delete()
      .eq('email', email)

    // Delete related queue entries
    await this.supabase
      .from('queue_history')
      .delete()
      .like('customer_id', 'DIR-%')

    // Delete notifications
    await this.supabase
      .from('customer_notifications')
      .delete()
      .like('customer_id', 'DIR-%')

    // Delete analytics events
    await this.supabase
      .from('analytics_events')
      .delete()
      .like('customer_id', 'DIR-%')
  }

  // Wait for async operations
  static async waitForCondition(
    condition: () => Promise<boolean>,
    timeout: number = 10000,
    interval: number = 500
  ): Promise<boolean> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true
      }
      await new Promise(resolve => setTimeout(resolve, interval))
    }
    
    return false
  }
}

// Integration test suites
describe('DirectoryBolt Integration Tests', () => {
  let testCustomer: ReturnType<typeof TestUtils.createTestCustomer>

  beforeEach(() => {
    testCustomer = TestUtils.createTestCustomer()
  })

  afterEach(async () => {
    await TestUtils.cleanupTestData(testCustomer.email)
  })

  describe('Streamlined Checkout Flow', () => {
    it('should complete the full streamlined checkout process', async () => {
      // 1. Create Stripe checkout session
      const session = await TestUtils.createTestStripeSession(testCustomer.email)
      expect(session.id).toMatch(/^cs_/)

      // 2. Simulate successful payment and redirect to business info collection
      const registrationResponse = await request(TEST_CONFIG.baseUrl)
        .post('/api/customer/register-complete')
        .send({
          ...testCustomer,
          session_id: session.id
        })
        .expect(201)

      expect(registrationResponse.body.success).toBe(true)
      expect(registrationResponse.body.data.customer_id).toMatch(/^DIR-\d{8}-[A-Z0-9]{6}$/)

      // 3. Verify customer was created in database
      const { data: customer, error } = await TestUtils.supabase
        .from('customers')
        .select('*')
        .eq('email', testCustomer.email)
        .single()

      expect(error).toBeNull()
      expect(customer).toBeTruthy()
      expect(customer.business_name).toBe(testCustomer.business_name)
      expect(customer.package_type).toBe(testCustomer.package_type)
      expect(customer.status).toBe('pending')

      // 4. Verify queue entry was created
      const { data: queueEntry } = await TestUtils.supabase
        .from('queue_history')
        .select('*')
        .eq('customer_id', customer.customer_id)
        .single()

      expect(queueEntry).toBeTruthy()
      expect(queueEntry.package_type).toBe(testCustomer.package_type)
      expect(queueEntry.directories_allocated).toBe(150) // Growth package

      // 5. Verify welcome notification was created
      const { data: notification } = await TestUtils.supabase
        .from('customer_notifications')
        .select('*')
        .eq('customer_id', customer.customer_id)
        .eq('notification_type', 'success')
        .single()

      expect(notification).toBeTruthy()
      expect(notification.title).toContain('Welcome')
    })

    it('should handle Stripe session validation errors', async () => {
      const response = await request(TEST_CONFIG.baseUrl)
        .post('/api/customer/register-complete')
        .send({
          ...testCustomer,
          session_id: 'cs_invalid_session_id'
        })
        .expect(400)

      expect(response.body.error).toBe('Invalid session')
    })

    it('should prevent duplicate customer registration', async () => {
      // First registration
      const session1 = await TestUtils.createTestStripeSession(testCustomer.email)
      await request(TEST_CONFIG.baseUrl)
        .post('/api/customer/register-complete')
        .send({
          ...testCustomer,
          session_id: session1.id
        })
        .expect(201)

      // Attempt duplicate registration
      const session2 = await TestUtils.createTestStripeSession(testCustomer.email)
      const response = await request(TEST_CONFIG.baseUrl)
        .post('/api/customer/register-complete')
        .send({
          ...testCustomer,
          session_id: session2.id
        })
        .expect(409)

      expect(response.body.error).toBe('Customer Exists')
    })
  })

  describe('Queue Management System', () => {
    it('should process customers based on priority levels', async () => {
      // Create customers with different package types
      const customers = [
        { ...TestUtils.createTestCustomer(), package_type: 'starter' as const },
        { ...TestUtils.createTestCustomer(), package_type: 'enterprise' as const },
        { ...TestUtils.createTestCustomer(), package_type: 'growth' as const }
      ]

      // Register all customers
      for (const customer of customers) {
        const session = await TestUtils.createTestStripeSession(customer.email)
        await request(TEST_CONFIG.baseUrl)
          .post('/api/customer/register-complete')
          .send({ ...customer, session_id: session.id })
          .expect(201)
      }

      // Check queue priorities
      const { data: queueEntries } = await TestUtils.supabase
        .from('queue_history')
        .select('customer_id, package_type, priority_level')
        .order('priority_level', { ascending: true })

      expect(queueEntries).toBeTruthy()
      if (queueEntries) {
        expect(queueEntries[0]?.package_type).toBe('enterprise') // Priority 1
        expect(queueEntries[1]?.package_type).toBe('growth') // Priority 3
        expect(queueEntries[2]?.package_type).toBe('starter') // Priority 4
      }

      // Cleanup
      for (const customer of customers) {
        await TestUtils.cleanupTestData(customer.email)
      }
    })
  })

  describe('Analytics System', () => {
    it('should track customer registration events', async () => {
      const session = await TestUtils.createTestStripeSession(testCustomer.email)
      
      const response = await request(TEST_CONFIG.baseUrl)
        .post('/api/customer/register-complete')
        .send({
          ...testCustomer,
          session_id: session.id
        })
        .expect(201)

      const customerId = response.body.data.customer_id

      // Wait for analytics event to be created
      const analyticsCreated = await TestUtils.waitForCondition(async () => {
        const { data } = await TestUtils.supabase
          .from('analytics_events')
          .select('*')
          .eq('customer_id', customerId)
          .eq('event_name', 'customer_registered')
          .single()
        return !!data
      })

      expect(analyticsCreated).toBe(true)

      // Verify analytics data
      const { data: analyticsEvent } = await TestUtils.supabase
        .from('analytics_events')
        .select('*')
        .eq('customer_id', customerId)
        .eq('event_name', 'customer_registered')
        .single()

      expect(analyticsEvent.event_type).toBe('registration')
      expect(analyticsEvent.event_data.package_type).toBe(testCustomer.package_type)
    })
  })

  describe('API Security', () => {
    it('should reject requests without proper validation', async () => {
      // Missing required fields
      const response = await request(TEST_CONFIG.baseUrl)
        .post('/api/customer/register-complete')
        .send({
          email: 'invalid-email'
        })
        .expect(400)

      expect(response.body.error).toBe('Validation Error')
    })

    it('should validate package types', async () => {
      const response = await request(TEST_CONFIG.baseUrl)
        .post('/api/customer/register-complete')
        .send({
          ...testCustomer,
          package_type: 'invalid_package'
        })
        .expect(400)

      expect(response.body.error).toBe('Validation Error')
      expect(response.body.message).toContain('Invalid package type')
    })
  })

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking database failures
      // Implementation depends on your testing framework setup
    })

    it('should handle Stripe API failures', async () => {
      const response = await request(TEST_CONFIG.baseUrl)
        .post('/api/customer/register-complete')
        .send({
          ...testCustomer,
          session_id: 'cs_test_invalid'
        })
        .expect(400)

      expect(response.body.error).toBe('Invalid session')
    })
  })
})

// Performance test suite
describe('Performance Tests', () => {
  it('should handle concurrent registrations', async () => {
    const concurrentRequests = 10
    const promises = []

    for (let i = 0; i < concurrentRequests; i++) {
      const customer = TestUtils.createTestCustomer()
      const sessionPromise = TestUtils.createTestStripeSession(customer.email)
        .then(session => 
          request(TEST_CONFIG.baseUrl)
            .post('/api/customer/register-complete')
            .send({ ...customer, session_id: session.id })
        )
      promises.push(sessionPromise)
    }

    const results = await Promise.allSettled(promises)
    const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).status === 201)
    
    expect(successful.length).toBeGreaterThan(concurrentRequests * 0.8) // 80% success rate
  })

  it('should complete registration within acceptable time limits', async () => {
    const customer = TestUtils.createTestCustomer()
    const session = await TestUtils.createTestStripeSession(customer.email)

    const startTime = Date.now()
    
    await request(TEST_CONFIG.baseUrl)
      .post('/api/customer/register-complete')
      .send({ ...customer, session_id: session.id })
      .expect(201)

    const duration = Date.now() - startTime
    expect(duration).toBeLessThan(5000) // Should complete within 5 seconds

    await TestUtils.cleanupTestData(customer.email)
  })
})

export { TestUtils }