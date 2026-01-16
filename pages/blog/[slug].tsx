import Head from 'next/head'
import { useRouter } from 'next/router'
import Header from '../../components/Header'
import Footer from '../../components/layout/Footer'

export default function BlogPost() {
    const router = useRouter()
    const { slug } = router.query

    // Map of slugs to titles (simple fallback)
    const titles: Record<string, string> = {
        'complete-guide-business-directory-submissions-2024': 'The Complete Guide to Business Directory Submissions (2024)',
        'google-business-profile-optimization-guide': 'Google Business Profile Optimization Guide',
        'local-seo-checklist-2024': 'The Ultimate Local SEO Checklist 2024'
    }

    const title = typeof slug === 'string' && titles[slug] ? titles[slug] : 'DirectoryBolt Blog'

    return (
        <>
            <Head>
                <title>{title} | DirectoryBolt</title>
            </Head>
            <div className="min-h-screen bg-role-bg-primary">
                <Header />
                <article className="max-w-4xl mx-auto px-4 py-16">
                    <div className="mb-8">
                        <span className="text-volt-600 font-bold mb-2 block">Blog</span>
                        <h1 className="text-4xl md:text-5xl font-black text-role-text-primary mb-6">
                            {title}
                        </h1>
                        <p className="text-role-text-secondary text-xl">
                            This comprehensive guide is coming soon! Our team is currently updating this resource with the latest 2026 strategies.
                        </p>
                    </div>

                    <div className="prose prose-lg prose-invert text-role-text-secondary">
                        <p>
                            In the meantime, check out our <a href="/analyze" className="text-volt-500 hover:text-volt-400">Free Website Analysis</a> tool to see how your business performs online.
                        </p>
                        <h3>What to expect in this guide:</h3>
                        <ul>
                            <li>Step-by-step submission strategies</li>
                            <li>Top 50 high-authority directories</li>
                            <li>Automation tips for maximum efficiency</li>
                        </ul>
                    </div>
                </article>
                <Footer />
            </div>
        </>
    )
}
