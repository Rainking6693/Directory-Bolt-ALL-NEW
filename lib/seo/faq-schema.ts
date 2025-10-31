export interface FAQ {
  question: string
  answer: string
}

export const generateFAQSchema = (faqs: FAQ[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqs.map(faq => ({
    "@type": "Question",
    "name": faq.question,
    "acceptedAnswer": {
      "@type": "Answer",
      "text": faq.answer
    }
  }))
})

// Common FAQs for directory submission service
export const directorySubmissionFAQs: FAQ[] = [
  {
    question: "What is directory submission service?",
    answer: "Directory submission service is an automated process that submits your business information to multiple online directories to improve your local SEO rankings and online visibility. Our AI-powered service submits to 500+ high-authority directories in days, not months."
  },
  {
    question: "How much does directory submission cost?",
    answer: "Our directory submission service pricing starts at $149 for the Starter plan (50 directories) and goes up to $799 for the Enterprise plan (500 directories). All plans include AI-optimized descriptions, real-time tracking, and 14-day free trial."
  },
  {
    question: "How long does directory submission take?",
    answer: "Our automated directory submission process typically takes 2-3 days to complete all submissions, compared to 100+ hours if done manually. You'll receive real-time updates on submission progress through our dashboard."
  },
  {
    question: "What directories do you submit to?",
    answer: "We submit to 500+ high-authority directories including Google My Business, Yelp, Yellow Pages, Better Business Bureau, and industry-specific directories. Our AI matches your business to the most relevant directories for maximum impact."
  },
  {
    question: "Is directory submission worth it?",
    answer: "Yes, directory submission is highly effective for local SEO. Studies show that businesses with consistent directory listings see 300% more local search visibility and generate 15+ more leads per month compared to those without proper directory presence."
  },
  {
    question: "What's the difference between automated and manual directory submission?",
    answer: "Automated directory submission saves 95% of your time (2-3 hours vs 100+ hours), ensures consistent NAP data across all directories, and provides real-time tracking. Manual submission gives you more control but is extremely time-consuming and error-prone."
  },
  {
    question: "Do you guarantee directory submission results?",
    answer: "While we can't guarantee specific rankings, we guarantee that your business will be submitted to all relevant directories with consistent, accurate information. Our 85%+ approval rate and money-back guarantee ensure you get results."
  },
  {
    question: "Can I track my directory submissions?",
    answer: "Yes, our real-time dashboard shows you the status of every directory submission, approval rates, and ranking improvements. You'll receive email notifications when submissions are approved or need attention."
  }
]

// Local SEO specific FAQs
export const localSEOFAQs: FAQ[] = [
  {
    question: "What are local SEO directories?",
    answer: "Local SEO directories are online platforms where businesses can list their information to improve local search rankings. These include Google My Business, Yelp, Yellow Pages, and 200+ other local directories that help customers find your business."
  },
  {
    question: "How do local directories help with SEO?",
    answer: "Local directories improve your SEO by building local authority, providing consistent NAP citations, increasing local search visibility, and generating more local leads. They're essential for ranking in 'near me' searches and Google My Business."
  },
  {
    question: "Which local directories are most important?",
    answer: "The most important local directories are Google My Business, Yelp, Yellow Pages, Better Business Bureau, and Bing Places. Industry-specific directories like Healthgrades (healthcare) and Zillow (real estate) are also crucial for relevant businesses."
  },
  {
    question: "How many local directories should I submit to?",
    answer: "We recommend submitting to at least 50-100 high-quality local directories for maximum impact. Our service submits to 200+ local directories, ensuring comprehensive coverage and maximum local SEO benefits."
  }
]
