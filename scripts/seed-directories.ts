
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const HIGH_DA_DIRECTORIES = [
    { name: 'Google Business Profile', website: 'https://www.google.com/business/', domain_authority: 100, category: 'General' },
    { name: 'Facebook', website: 'https://www.facebook.com/pages/create', domain_authority: 100, category: 'Social' },
    { name: 'LinkedIn', website: 'https://www.linkedin.com/company/setup/new/', domain_authority: 99, category: 'Professional' },
    { name: 'Apple Maps', website: 'https://register.apple.com/placesonmaps/', domain_authority: 99, category: 'General' },
    { name: 'Bing Places', website: 'https://www.bingplaces.com/', domain_authority: 94, category: 'General' },
    { name: 'Yelp', website: 'https://biz.yelp.com/', domain_authority: 93, category: 'General' },
    { name: 'Better Business Bureau', website: 'https://www.bbb.org/', domain_authority: 91, category: 'General' },
    { name: 'Foursquare', website: 'https://foursquare.com/business/', domain_authority: 91, category: 'General' },
    { name: 'MapQuest', website: 'https://business.mapquest.com/', domain_authority: 88, category: 'General' },
    { name: 'YellowPages', website: 'https://marketing.yp.com/claim', domain_authority: 87, category: 'General' },
    { name: 'Angi', website: 'https://www.angi.com/pro', domain_authority: 86, category: 'Home Services' },
    { name: 'Thumbtack', website: 'https://www.thumbtack.com/pro', domain_authority: 84, category: 'Home Services' },
    { name: 'Nextdoor', website: 'https://business.nextdoor.com/', domain_authority: 82, category: 'Local' },
    { name: 'Manta', website: 'https://www.manta.com/add-business', domain_authority: 81, category: 'B2B' },
    { name: 'Crunchbase', website: 'https://www.crunchbase.com/', domain_authority: 90, category: 'Startup/Tech' },
    { name: 'Instagram', website: 'https://business.instagram.com/', domain_authority: 99, category: 'Social' },
    { name: 'Pinterest', website: 'https://business.pinterest.com/', domain_authority: 94, category: 'Social' },
    { name: 'Twitter', website: 'https://business.twitter.com/', domain_authority: 99, category: 'Social' },
    { name: 'Local.com', website: 'https://www.local.com/', domain_authority: 60, category: 'General' },
    { name: 'Superpages', website: 'https://www.superpages.com/', domain_authority: 65, category: 'General' },
    { name: 'ChamberOfCommerce.com', website: 'https://www.chamberofcommerce.com/', domain_authority: 60, category: 'B2B' },
    { name: 'Hotfrog', website: 'https://www.hotfrog.com/', domain_authority: 55, category: 'General' },
    { name: 'MerchantCircle', website: 'https://www.merchantcircle.com/', domain_authority: 70, category: 'Local' },
    { name: 'EZLocal', website: 'https://ezlocal.com/', domain_authority: 50, category: 'Local' },
    { name: 'Alignable', website: 'https://www.alignable.com/', domain_authority: 75, category: 'B2B' },
    { name: 'Spoke', website: 'https://www.spoke.com/', domain_authority: 60, category: 'B2B' },
    { name: 'Blogarama', website: 'https://www.blogarama.com/', domain_authority: 65, category: 'Blog' }
]

async function seedDirectories() {
    console.log('Starting directory seed...')

    for (const dir of HIGH_DA_DIRECTORIES) {
        // Check if exists
        const { data: existing } = await supabase
            .from('directories')
            .select('id')
            .eq('name', dir.name)
            .single()

        if (existing) {
            // Update
            const { error } = await supabase
                .from('directories')
                .update({
                    website: dir.website,
                    domain_authority: dir.domain_authority,
                    category: dir.category,
                    active: true,
                    description: `High authority directory: ${dir.name}`,
                    submission_url: dir.website
                })
                .eq('id', existing.id)

            if (error) console.error(`Failed to update ${dir.name}:`, error)
            else console.log(`Updated ${dir.name}`)
        } else {
            // Insert
            const { error } = await supabase
                .from('directories')
                .insert({
                    name: dir.name,
                    website: dir.website,
                    domain_authority: dir.domain_authority,
                    category: dir.category,
                    active: true,
                    description: `High authority directory: ${dir.name}`,
                    submission_url: dir.website
                })

            if (error) console.error(`Failed to insert ${dir.name}:`, error)
            else console.log(`Inserted ${dir.name}`)
        }
    }

    console.log('Seed completed.')
}

seedDirectories()
