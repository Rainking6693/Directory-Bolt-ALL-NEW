import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { directorySubmissionTask } from '../../trigger/submission'
import { AutoBoltNotificationService } from '../../lib/services/autobolt-notifications'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase credentials missing')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const {
            businessName, email, website, description, phone,
            address, city, state, zip, category, keywords,
            customerId, plan
        } = req.body

        const dbData = {
            business_name: businessName,
            email,
            website,
            description,
            phone,
            address,
            city,
            state,
            zip,
            category,
            status: 'active',
            business_data: { keywords: keywords.split(',').map((k: string) => k.trim()) },
            ...(customerId ? { customer_id: customerId } : { customer_id: `cust_${Date.now()}` })
        }

        const { data: customer, error: dbError } = await supabase
            .from('customers')
            .upsert(dbData)
            .select()
            .single()

        if (dbError) {
            console.error('Supabase Error:', dbError)
            return res.status(500).json({ error: 'Failed to save customer data' })
        }

        // Send Welcome Notification (Non-blocking)
        AutoBoltNotificationService.sendWelcomeNotification(
            customer.customer_id,
            email,
            businessName,
            plan || 'Starter'
        ).catch(err => console.error('Failed to send welcome email:', err))

        // 2. Determine Directory Limit based on Plan
        // Default to 'starter' if plan is invalid or missing
        const validPlans = ['starter', 'growth', 'professional', 'enterprise'] as const
        const selectedPlan = validPlans.includes(plan) ? plan : 'starter'

        // Limits based on PRICING_TIERS in lib/config/pricing.ts
        const PLAN_LIMITS = {
            starter: 100,
            growth: 250,
            professional: 400,
            enterprise: 500
        }

        const limit = PLAN_LIMITS[selectedPlan as keyof typeof PLAN_LIMITS] || 100

        // 3. Fetch High DA Directories from Supabase
        // Get top X directories sorted by DA, based on plan limit
        const { data: directories, error: dirError } = await supabase
            .from('directories')
            .select('name, website, domain_authority')
            .eq('active', true)
            .order('domain_authority', { ascending: false })
            .limit(limit)

        if (dirError || !directories || directories.length === 0) {
            console.error('Directory Fetch Error:', dirError)
            return res.status(500).json({ error: 'Failed to fetch directories' })
        }

        // 2. Create Master Job Record
        const { data: job, error: jobError } = await supabase
            .from('jobs')
            .insert({
                customer_id: customer.customer_id,
                status: 'processing',
                package_type: plan || 'starter',
                package_size: limit,
                directory_limit: limit,
                business_name: businessName,
                website: website,
                email: email,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single()

        if (jobError) {
            console.error('Job Creation Error:', jobError)
            return res.status(500).json({ error: 'Failed to create job' })
        }

        // 3. Split into 4 batches and trigger workers
        const BATCH_COUNT = 4
        const batchSize = Math.ceil(directories.length / BATCH_COUNT)
        const triggerResults = []

        for (let i = 0; i < BATCH_COUNT; i++) {
            const start = i * batchSize
            const end = start + batchSize
            const batchDirs = directories.slice(start, end).map(d => d.name)

            if (batchDirs.length > 0) {
                console.log(`Triggering batch ${i + 1} with ${batchDirs.length} directories`)
                const handle = await directorySubmissionTask.trigger({
                    jobId: job.id, // Use the master Job ID
                    businessData: dbData,
                    targetDirectories: batchDirs,
                    batchIndex: i + 1,
                    totalBatches: BATCH_COUNT
                })
                triggerResults.push(handle)
            }
        }

        return res.status(200).json({
            success: true,
            customer,
            batchesTriggered: triggerResults.length,
            directoriesQueued: directories.length
        })

    } catch (error) {
        console.error('Onboarding Error:', error)
        return res.status(500).json({ error: 'Internal Server Error' })
    }
}
