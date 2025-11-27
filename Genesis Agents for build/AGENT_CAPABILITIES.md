# Genesis Agent Capabilities for Directory-Bolt

## 🤖 All 26 Available Agents

### Core Development Agents

**1. builder_agent.py** ⭐ MOST USED
- Builds React/Next.js components
- Creates backend API endpoints
- Generates database schemas
- Fixes bugs in existing code
- **Use for:** Any feature development on Directory-Bolt

**2. frontend_agent.py**
- Specialized in UI/UX development
- React, Next.js, Tailwind CSS
- Component styling and responsiveness
- **Use for:** Pure frontend work

**3. backend_agent.py**
- API development (REST, GraphQL)
- Database design and queries
- Server-side logic
- **Use for:** Backend features, database work

**4. spec_agent.py**
- Creates technical specifications
- Defines requirements
- Architecture planning
- **Use for:** Planning large features before building

### Quality & Testing Agents

**5. qa_agent.py** ⭐ IMPORTANT
- Generates unit tests
- Creates integration tests
- E2E testing with Playwright
- Bug reproduction and verification
- **Use for:** Testing anything on Directory-Bolt

**6. security_agent.py** ⭐ CRITICAL
- Security audits (XSS, SQL injection, CSRF)
- Authentication/authorization checks
- API security analysis
- Dependency vulnerability scanning
- **Use for:** Security audits, especially before launch

### Business & Marketing Agents

**7. billing_agent.py** ⭐ YOU ASKED ABOUT THIS
- Stripe integration (subscriptions, one-time payments)
- Payment webhook handlers
- Subscription management UI
- Pricing tier setup
- **Use for:** Adding paid plans to Directory-Bolt

**8. marketing_agent.py**
- Landing page copy
- Email campaigns
- Social media content
- Marketing automation
- **Use for:** Marketing materials for Directory-Bolt

**9. seo_agent.py** ⭐ IMPORTANT FOR DIRECTORY
- Meta tags optimization
- Sitemap generation
- Keyword research
- Content optimization
- **Use for:** Getting Directory-Bolt ranked on Google

**10. content_agent.py**
- Blog posts
- Documentation
- Product descriptions
- Help articles
- **Use for:** Content for Directory-Bolt blog/docs

**11. pricing_agent.py**
- Pricing strategy analysis
- Competitor research
- Tier recommendations
- **Use for:** Deciding on pricing for Directory-Bolt

### User Experience Agents

**12. onboarding_agent.py**
- User onboarding flows
- Tutorial creation
- Welcome emails
- Feature tours
- **Use for:** Helping new Directory-Bolt users get started

**13. support_agent.py**
- FAQ generation
- Help documentation
- Support ticket templates
- Chatbot responses
- **Use for:** Customer support for Directory-Bolt

**14. email_agent.py**
- Transactional emails (welcome, password reset)
- Email templates
- Newsletter campaigns
- **Use for:** All email communications

### Deployment & Operations Agents

**15. deploy_agent.py** ⭐ IMPORTANT
- Deploy to Railway, Render, Vercel
- GitHub Actions CI/CD
- Environment configuration
- **Use for:** Deploying Directory-Bolt updates

**16. domain_name_agent.py**
- Domain registration via Name.com API
- DNS configuration
- SSL setup
- **Use for:** If you need a custom domain

**17. maintenance_agent.py**
- Dependency updates
- Performance monitoring
- Database optimization
- **Use for:** Keeping Directory-Bolt healthy

### Analysis & Research Agents

**18. analyst_agent.py**
- Data analysis
- User behavior insights
- A/B test analysis
- **Use for:** Understanding Directory-Bolt user data

**19. research_discovery_agent.py**
- Competitor research
- Market analysis
- Feature discovery
- **Use for:** Finding what features to add to Directory-Bolt

**20. reflection_agent.py**
- Code review
- Architecture review
- Best practices enforcement
- **Use for:** Quality checking Directory-Bolt code

### Legal & Compliance Agents

**21. legal_agent.py**
- Terms of Service generation
- Privacy Policy creation
- GDPR compliance
- **Use for:** Legal docs for Directory-Bolt

**22. finance_agent.py**
- Financial reporting
- Revenue tracking
- Cost analysis
- **Use for:** Tracking Directory-Bolt revenue

### E-commerce Agents (if needed)

**23. commerce_agent.py**
- Shopping cart
- Product catalog
- Inventory management
- **Use for:** If Directory-Bolt becomes a store

### Advanced/Specialized Agents

**24. darwin_agent.py**
- Self-improvement via evolution strategies
- Model fine-tuning
- Performance optimization
- **Use for:** Advanced AI/ML work

**25. se_darwin_agent.py**
- Software engineering evolution
- Code pattern learning
- **Use for:** Advanced development automation

**26. genesis_meta_agent.py** ⭐ THE BOSS
- Master orchestrator
- Coordinates all other agents
- Makes decisions on which agents to use
- **Use for:** Complex tasks requiring multiple agents

---

## 📋 Recommended Workflow for Directory-Bolt

### Phase 1: Core Features (Week 1-2)
```bash
# 1. Build user authentication
RUN_AGENTS.bat build_feature "Add user authentication with email/password and OAuth"

# 2. Add listing submission
RUN_AGENTS.bat build_feature "Allow users to submit AI tools for review"

# 3. Generate tests
RUN_AGENTS.bat generate_tests
```

### Phase 2: Monetization (Week 3)
```bash
# 4. Add Stripe billing
RUN_AGENTS.bat add_billing

# 5. Create pricing page
RUN_AGENTS.bat build_feature "Create pricing page showing Free, Pro, and Enterprise tiers"
```

### Phase 3: SEO & Marketing (Week 4)
```bash
# 6. SEO optimization
RUN_AGENTS.bat optimize_seo

# 7. Create blog
RUN_AGENTS.bat build_feature "Add blog section for AI industry news"
```

### Phase 4: Security & Launch (Week 5)
```bash
# 8. Security audit
RUN_AGENTS.bat audit_security

# 9. Deploy to production
RUN_AGENTS.bat deploy
```

---

## 🎯 Most Important Agents for Directory-Bolt

**Must Use:**
1. **builder_agent** - All feature development
2. **billing_agent** - Monetization (Stripe)
3. **seo_agent** - Getting traffic to your directory
4. **qa_agent** - Making sure everything works
5. **security_agent** - Protecting user data

**Should Use:**
6. **deploy_agent** - Easy deployments
7. **marketing_agent** - Growing your directory
8. **onboarding_agent** - Converting visitors to users

**Nice to Have:**
9. **domain_name_agent** - Custom domain setup
10. **support_agent** - Customer support automation

---

## 💡 Quick Examples

### Example 1: Add Featured Listings
```bash
RUN_AGENTS.bat build_feature "Add featured listings that appear at the top with a gold badge and highlighted background"
```

**What happens:**
1. Genesis Meta-Agent analyzes the request
2. Routes to Builder Agent for implementation
3. QA Agent generates tests
4. Security Agent checks for vulnerabilities
5. Complete feature is built and tested

### Example 2: Add Stripe Payments
```bash
RUN_AGENTS.bat add_billing
```

**What happens:**
1. Billing Agent creates Stripe checkout
2. Builder Agent integrates with backend
3. QA Agent tests payment flows
4. Complete billing system ready to use

### Example 3: Fix Slow Performance
```bash
RUN_AGENTS.bat fix_bug "Homepage loads slowly when displaying 200+ listings"
```

**What happens:**
1. QA Agent reproduces the performance issue
2. Builder Agent optimizes queries and adds pagination
3. QA Agent verifies performance improvement
4. Bug fixed with tests to prevent regression

---

## 🔗 How Agents Work Together

When you run a task, agents collaborate:

```
Your Request
    ↓
Genesis Meta-Agent (decides what to do)
    ↓
HALO Router (routes to appropriate agents)
    ↓
┌─────────────┬──────────────┬───────────────┐
│ Builder     │ QA Agent     │ Security      │
│ (builds)    │ (tests)      │ (audits)      │
└─────────────┴──────────────┴───────────────┘
    ↓
Complete Feature with Tests & Security Checks
```

---

## ⚡ Pro Tips

1. **Start with small tasks** to test the system
2. **Always generate tests** after building features
3. **Run security audits** before deploying
4. **Use SEO agent early** to optimize for search engines
5. **Billing agent** for monetization when you have users

---

**Need help?** Check `README.md` for detailed usage instructions.
