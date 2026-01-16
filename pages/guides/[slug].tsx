import Head from 'next/head'
import { useRouter } from 'next/router'
import Header from '../../components/Header'
import Footer from '../../components/layout/Footer'

export default function GuidePost() {
    const router = useRouter()
    const { slug } = router.query

    return (
        <>
            <Head>
                <title>Directory Guide | DirectoryBolt</title>
            </Head>
            <div className="min-h-screen bg-role-bg-primary">
                <Header />
                <article className="max-w-4xl mx-auto px-4 py-16">
                    <div className="mb-8">
                        <span className="text-volt-600 font-bold mb-2 block">Guides</span>
                        <h1 className="text-4xl md:text-5xl font-black text-role-text-primary mb-6">
                            Directory Submission Guide
                        </h1>
                        <p className="text-role-text-secondary text-xl">
                            This guide is currently being updated for the latest directory algorithms.
                        </p>
                    </div>
                    <div className="prose prose-lg prose-invert text-role-text-secondary">
                        <p>Check back soon for the definitive guide to improving your local SEO rankings.</p>
                    </div>
                </article>
                <Footer />
            </div>
        </>
    )
}
