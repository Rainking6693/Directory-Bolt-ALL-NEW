import Head from 'next/head'
import Link from 'next/link'
import Header from '../components/Header'
import Footer from '../components/layout/Footer'

export default function BlogPage() {
  const blogPosts = [
    {
      title: 'Complete Guide to Business Directory Submissions 2024',
      slug: 'complete-guide-business-directory-submissions-2024',
      excerpt: 'Learn everything you need to know about submitting your business to online directories in 2024.',
      date: '2024-01-15',
      category: 'Guides',
      readTime: '10 min read',
    },
    {
      title: 'Google Business Profile Optimization Guide',
      slug: 'google-business-profile-optimization-guide',
      excerpt: 'Master Google Business Profile optimization to improve your local search rankings and attract more customers.',
      date: '2024-01-10',
      category: 'SEO',
      readTime: '8 min read',
    },
    {
      title: 'Local SEO Checklist 2024',
      slug: 'local-seo-checklist-2024',
      excerpt: 'A comprehensive checklist to improve your local SEO and dominate local search results.',
      date: '2024-01-05',
      category: 'SEO',
      readTime: '12 min read',
    },
  ]

  return (
    <>
      <Head>
        <title>Blog - DirectoryBolt | SEO Tips & Directory Submission Guides</title>
        <meta name="description" content="Learn about directory submissions, local SEO, and online visibility. Expert guides and tips to grow your business online." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://directorybolt.com/blog" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900">
        <Header />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-black text-white mb-6">
              DirectoryBolt
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-volt-400 to-volt-600">
                Blog
              </span>
            </h1>
            <p className="text-xl text-secondary-200 max-w-3xl mx-auto">
              Expert guides, tips, and insights on directory submissions, local SEO, and growing your online presence.
            </p>
          </div>

          {/* Featured Post */}
          {blogPosts.length > 0 && (
            <div className="mb-16">
              <div className="bg-secondary-800/50 backdrop-blur-sm rounded-2xl border border-volt-500/30 overflow-hidden hover:border-volt-500/50 transition-all duration-300">
                <div className="p-8 md:p-12">
                  <div className="flex items-center gap-4 mb-4">
                    <span className="bg-volt-500/20 text-volt-400 px-3 py-1 rounded-full text-sm font-bold">
                      Featured
                    </span>
                    <span className="text-secondary-400 text-sm">{blogPosts[0].category}</span>
                    <span className="text-secondary-600">•</span>
                    <span className="text-secondary-400 text-sm">{blogPosts[0].readTime}</span>
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 hover:text-volt-400 transition-colors">
                    <Link href={`/blog/${blogPosts[0].slug}`}>
                      {blogPosts[0].title}
                    </Link>
                  </h2>
                  <p className="text-secondary-200 text-lg mb-6">
                    {blogPosts[0].excerpt}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-secondary-400 text-sm">
                      {new Date(blogPosts[0].date).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </span>
                    <Link
                      href={`/blog/${blogPosts[0].slug}`}
                      className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold px-6 py-3 rounded-xl hover:from-volt-400 hover:to-volt-500 transition-all duration-300"
                    >
                      Read More →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Blog Posts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogPosts.slice(1).map((post) => (
              <div
                key={post.slug}
                className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 overflow-hidden hover:border-volt-500/50 transition-all duration-300 group"
              >
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-volt-400 text-sm font-bold">{post.category}</span>
                    <span className="text-secondary-600">•</span>
                    <span className="text-secondary-400 text-sm">{post.readTime}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3 group-hover:text-volt-400 transition-colors">
                    <Link href={`/blog/${post.slug}`}>
                      {post.title}
                    </Link>
                  </h3>
                  <p className="text-secondary-200 mb-4 line-clamp-3">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-secondary-400 text-sm">
                      {new Date(post.date).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </span>
                    <Link
                      href={`/blog/${post.slug}`}
                      className="text-volt-400 hover:text-volt-300 font-medium text-sm"
                    >
                      Read More →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Coming Soon Message */}
          <div className="mt-16 text-center">
            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8 max-w-2xl mx-auto">
              <h3 className="text-2xl font-bold text-white mb-4">
                More Content Coming Soon!
              </h3>
              <p className="text-secondary-200 mb-6">
                We're working on more helpful guides and articles. Subscribe to our newsletter to get notified when new content is published.
              </p>
              <form className="flex gap-4 max-w-md mx-auto">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-3 bg-secondary-900/70 border border-secondary-700 rounded-xl text-white placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-volt-400/70 focus:border-volt-400"
                />
                <button
                  type="submit"
                  className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold px-6 py-3 rounded-xl hover:from-volt-400 hover:to-volt-500 transition-all duration-300"
                >
                  Subscribe
                </button>
              </form>
            </div>
          </div>

          {/* Categories */}
          <div className="mt-16">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">Browse by Category</h2>
            <div className="flex flex-wrap justify-center gap-4">
              {['All Posts', 'Guides', 'SEO', 'Directory Tips', 'Case Studies', 'Updates'].map((category) => (
                <button
                  key={category}
                  className="bg-secondary-800/50 backdrop-blur-sm border border-secondary-700 text-secondary-200 px-6 py-3 rounded-xl hover:border-volt-500/50 hover:text-volt-400 transition-all duration-300"
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </>
  )
}

