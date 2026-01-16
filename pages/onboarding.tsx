
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import Header from '../components/Header'
import Footer from '../components/layout/Footer'
import { Card } from '../redesign-v2/components/ui/Card'
import { Button } from '../redesign-v2/components/ui/Button'
import { Input } from '../redesign-v2/components/ui/Input'
import { Label } from '../redesign-v2/components/ui/Label'

export default function OnboardingPage() {
    const router = useRouter()
    const { plan, customer_id } = router.query
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        businessName: '',
        email: '',
        website: '',
        description: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        category: '',
        keywords: ''
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const res = await fetch('/api/onboarding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    plan: plan as string,
                    customerId: customer_id as string // Passed from checkout success
                })
            })

            if (!res.ok) throw new Error('Submission failed')

            // Save customer ID for dashboard access
            if (customer_id) {
                localStorage.setItem('customerId', customer_id as string)
            }

            router.push('/dashboard?onboarding=complete')
        } catch (error) {
            console.error(error)
            alert('Failed to save details. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <Head>
                <title>Setup Your Profile | DirectoryBolt</title>
            </Head>
            <div className="min-h-screen bg-role-bg-primary">
                <Header />

                <div className="max-w-3xl mx-auto px-4 py-16">
                    <Card variant="artifact" className="p-8">
                        <div className="text-center mb-8">
                            <h1 className="text-3xl font-black text-role-text-primary mb-2">
                                Let's Get Your Business Listed
                            </h1>
                            <p className="text-role-text-secondary">
                                We need a few more details to start your directory submissions.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <Label htmlFor="businessName">Business Name</Label>
                                    <Input
                                        id="businessName"
                                        name="businessName"
                                        value={formData.businessName}
                                        onChange={handleChange}
                                        required
                                        placeholder="e.g. Acme Corp"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="email">Work Email</Label>
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                        placeholder="you@company.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="website">Website URL</Label>
                                <Input
                                    id="website"
                                    name="website"
                                    value={formData.website}
                                    onChange={handleChange}
                                    required
                                    placeholder="https://example.com"
                                />
                            </div>

                            <div>
                                <Label htmlFor="description">Business Description</Label>
                                <textarea
                                    id="description"
                                    name="description"
                                    rows={4}
                                    value={formData.description}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-2 bg-white border border-role-border-default rounded-lg focus:ring-2 focus:ring-volt-500 focus:border-transparent"
                                    placeholder="Describe your business, products, and services..."
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <Label htmlFor="category">Category</Label>
                                    <Input
                                        id="category"
                                        name="category"
                                        value={formData.category}
                                        onChange={handleChange}
                                        required
                                        placeholder="e.g. Marketing Agency"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="phone">Phone Number</Label>
                                    <Input
                                        id="phone"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        required
                                        placeholder="(555) 123-4567"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="address">Street Address</Label>
                                <Input
                                    id="address"
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    required
                                    placeholder="123 Main St"
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label htmlFor="city">City</Label>
                                    <Input id="city" name="city" value={formData.city} onChange={handleChange} required />
                                </div>
                                <div>
                                    <Label htmlFor="state">State</Label>
                                    <Input id="state" name="state" value={formData.state} onChange={handleChange} required />
                                </div>
                                <div>
                                    <Label htmlFor="zip">ZIP</Label>
                                    <Input id="zip" name="zip" value={formData.zip} onChange={handleChange} required />
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="keywords">Keywords (comma separated)</Label>
                                <Input
                                    id="keywords"
                                    name="keywords"
                                    value={formData.keywords}
                                    onChange={handleChange}
                                    placeholder="marketing, seo, digital agency"
                                />
                            </div>

                            <Button
                                variant="primary"
                                className="w-full mt-6"
                                disabled={loading}
                            >
                                {loading ? 'Starting Submissions...' : 'Start Submissions via Trigger.dev 🚀'}
                            </Button>
                        </form>
                    </Card>
                </div>
                <Footer />
            </div>
        </>
    )
}
