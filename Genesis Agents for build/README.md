# Genesis Agents for Directory-Bolt

This folder contains **26 Genesis AI agents** configured to work on your Directory-Bolt website.

## ⚠️ Important: Agents Need Instructions

**Agents don't automatically "activate"** by being in a folder. They need:
1. **Tasks** - What to build/fix/improve
2. **Context** - Information about your website
3. **Orchestration** - Something to coordinate them

The `orchestrate_directory_bolt.py` script provides all three.

## 📁 Folder Structure

```
Genesis Agents for build/
├── agents/                           # 25 specialized agents
│   ├── billing_agent.py             # Stripe billing integration
│   ├── builder_agent.py             # Build components
│   ├── seo_agent.py                 # SEO optimization
│   ├── security_agent.py            # Security audits
│   ├── qa_agent.py                  # Testing and QA
│   ├── deploy_agent.py              # Deployment
│   └── ... (21 more agents)
│
├── infrastructure/                   # Core infrastructure
│   ├── genesis_meta_agent.py        # Master orchestrator (26th agent)
│   ├── halo_router.py               # Routes tasks to appropriate agents
│   └── standard_integration_mixin.py # Provides 459 integrations to all agents
│
├── scripts/
│   └── orchestrate_directory_bolt.py # MAIN CONTROL SCRIPT
│
└── README.md                         # This file
```

## 🚀 How to Use Genesis Agents

### Prerequisites

1. **Set API keys** in your `.env` file (in Directory-Bolt root):
```env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
```

2. **Install dependencies** (if needed):
```bash
cd "C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\Genesis Agents for build"
pip install anthropic openai google-generativeai stripe pydantic
```

### Available Commands

**1. Build a New Feature:**
```bash
python scripts/orchestrate_directory_bolt.py --task build_feature --description "Add user ratings and reviews system"
```

**2. Add Stripe Billing Integration:**
```bash
python scripts/orchestrate_directory_bolt.py --task add_billing
```

This will create:
- Stripe checkout pages (Free, Pro, Enterprise tiers)
- Payment webhook handlers
- Subscription management UI
- Database models for subscriptions

**3. SEO Optimization:**
```bash
python scripts/orchestrate_directory_bolt.py --task optimize_seo
```

This will:
- Analyze current SEO
- Generate meta tags
- Create sitemap
- Optimize page titles/descriptions
- Provide keyword recommendations

**4. Security Audit:**
```bash
python scripts/orchestrate_directory_bolt.py --task audit_security
```

Scans for:
- XSS vulnerabilities
- SQL injection
- Authentication issues
- API security problems

**5. Fix a Bug:**
```bash
python scripts/orchestrate_directory_bolt.py --task fix_bug --description "Search results not showing featured listings first"
```

This will:
1. QA Agent reproduces the bug
2. Builder Agent fixes it
3. QA Agent verifies the fix

**6. Generate Tests:**
```bash
python scripts/orchestrate_directory_bolt.py --task generate_tests
```

Creates:
- Unit tests
- Integration tests
- E2E tests

## 🤖 How Agents Work Together

When you run a task, here's what happens:

1. **Genesis Meta-Agent** (master orchestrator) receives your task
2. **HALO Router** analyzes the task and routes to appropriate agents
3. **Specialized Agents** execute their part:
   - Billing Agent → Stripe integration
   - Builder Agent → Code generation
   - SEO Agent → Optimization
   - QA Agent → Testing
   - Security Agent → Audits
   - Deploy Agent → Deployment

4. **StandardIntegrationMixin** gives each agent access to 459 integrations:
   - MCP Client (50+ external tools)
   - Type-Safe Schemas (validation)
   - Context System (memory)
   - VOIX Framework (browser automation)
   - And 455 more...

## 📊 Example: Add Billing to Directory-Bolt

```bash
# Run billing integration
python scripts/orchestrate_directory_bolt.py --task add_billing

# What happens:
# 1. Billing Agent creates Stripe checkout components
# 2. Builder Agent integrates with your backend
# 3. QA Agent generates tests for payment flows
# 4. Security Agent audits payment security
# 5. Genesis Meta-Agent coordinates all of them

# Output:
# ✅ Billing integration complete!
# - Created: stripe_checkout.tsx
# - Created: webhook_handler.py
# - Created: subscription_manager.tsx
# - Created: payment_tests.py
# - Quality score: 87/100
```

## 🎯 Common Use Cases for Directory-Bolt

### Add Featured Listings
```bash
python scripts/orchestrate_directory_bolt.py --task build_feature --description "Add featured listings with priority placement and highlighted styling"
```

### Improve Directory Search
```bash
python scripts/orchestrate_directory_bolt.py --task build_feature --description "Add fuzzy search, filters by category, and sorting options"
```

### Add User Submissions
```bash
python scripts/orchestrate_directory_bolt.py --task build_feature --description "Allow users to submit their own AI tools for review"
```

### Fix Performance Issues
```bash
python scripts/orchestrate_directory_bolt.py --task fix_bug --description "Homepage loads slowly with 100+ listings"
```

## 🔧 Advanced: Call Individual Agents

You can also call individual agents directly:

```python
from agents.billing_agent import BillingAgent
from agents.seo_agent import SEOAgent

# Use billing agent
billing = BillingAgent()
result = await billing.create_stripe_subscription(
    plan_name="Pro",
    price=29,
    features=["Unlimited listings", "Featured placement"]
)

# Use SEO agent
seo = SEOAgent()
result = await seo.generate_meta_tags(
    page_title="AI Tools Directory",
    description="Discover the best AI tools and agents"
)
```

## 📝 Notes

- **Agents require API keys** (Anthropic, OpenAI, or Gemini)
- **Agents work on YOUR codebase** (Directory-Bolt website in parent folder)
- **Agents coordinate automatically** via HALO Router
- **Quality scores** range from 0-100 (aim for >70)
- **All changes are logged** in `logs/` directory

## 🆘 Troubleshooting

**"Module not found" errors:**
```bash
# Make sure you're in the right directory
cd "C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\Genesis Agents for build"

# Check Python path includes current directory
export PYTHONPATH=$PYTHONPATH:$(pwd)
```

**"No API key" errors:**
Set at least one of these in `.env`:
```env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
```

**Agents not finding Directory-Bolt:**
The orchestrator assumes Directory-Bolt is in the parent folder:
```
Github/
├── Directory-Bolt-ALL-NEW/          ← Your website
│   └── Genesis Agents for build/    ← Agents are here
```

## 🎓 Learn More

- See `CLAUDE.md` in the Genesis repo for full documentation
- Check `Genesis Systems Audit.md` for complete agent list
- All 26 agents inherit 459 integrations via StandardIntegrationMixin

---

**Next Steps:**
1. Set your API keys in `.env`
2. Run your first task: `python scripts/orchestrate_directory_bolt.py --task optimize_seo`
3. Check the output and quality score
4. Iterate and improve!
