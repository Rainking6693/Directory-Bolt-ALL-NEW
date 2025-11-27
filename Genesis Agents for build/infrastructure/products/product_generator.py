"""
Product Generator - Autonomous Application Creation for Genesis Meta-Agent

This module generates complete, production-ready applications using Claude Sonnet 4.
Replaces static HTML sites with real working applications (SaaS, Content, E-commerce).

Architecture:
- Claude Sonnet 4 for code generation (72.7% SWE-bench accuracy)
- Claude Haiku 4.5 for validation (faster, cheaper)
- Template-based generation with learned patterns
- Integration with SE-Darwin for evolution

Technology Stacks:
- SaaS: Next.js 14 + Supabase + Tailwind CSS
- Content: Next.js 14 + MDX + Contentlayer
- E-commerce: Next.js 14 + Stripe + Prisma + PostgreSQL
"""

import asyncio
import json
import logging
import os
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

logger = logging.getLogger(__name__)


class BusinessType(Enum):
    """Business types for product generation."""
    SAAS = "saas"
    CONTENT = "content"
    ECOMMERCE = "ecommerce"


@dataclass
class ProductRequirements:
    """Requirements for product generation."""
    business_type: BusinessType
    name: str
    description: str
    features: List[str]
    target_audience: str
    monetization_model: str
    tech_preferences: Optional[Dict[str, str]] = None
    custom_requirements: Optional[List[str]] = None


@dataclass
class GeneratedProduct:
    """Generated product with all files and metadata."""
    files: Dict[str, str]  # filename -> content
    product_type: BusinessType
    tech_stack: List[str]
    setup_instructions: str
    environment_vars: Dict[str, str]
    deployment_config: Dict[str, Any]
    quality_score: float = 0.0
    generation_time_seconds: float = 0.0
    validation_results: Optional[Dict[str, Any]] = None


class ProductGenerator:
    """
    Generate complete, deployable applications using Claude Sonnet 4.

    This class replaces static site generation with real application generation.
    Integrates with SE-Darwin for template evolution and quality improvement.
    """

    def __init__(
        self,
        anthropic_api_key: Optional[str] = None,
        use_haiku_for_validation: bool = True,
        evolution_archive_path: Optional[Path] = None
    ):
        """
        Initialize product generator.

        Args:
            anthropic_api_key: Anthropic API key (defaults to ANTHROPIC_API_KEY env var)
            use_haiku_for_validation: Use Haiku 4.5 for validation (cheaper/faster)
            evolution_archive_path: Path to SE-Darwin evolution archive
        """
        # Check if we should use local LLMs (cost-free)
        self.use_local_llms = os.getenv("USE_LOCAL_LLMS", "false").lower() == "true"
        self.local_llm_url = os.getenv("LOCAL_LLM_URL", "http://127.0.0.1:8003")

        self.api_key = anthropic_api_key or os.getenv("ANTHROPIC_API_KEY")
        self.use_haiku_for_validation = use_haiku_for_validation
        self.evolution_archive_path = evolution_archive_path

        if self.use_local_llms:
            logger.info(f"Using local LLM at {self.local_llm_url} (COST-FREE)")
        elif not self.api_key:
            logger.warning("No Anthropic API key provided. Product generation will fail.")

        # Initialize LLM client (local LLM or Anthropic)
        self.client = None
        self.local_client = None

        if self.use_local_llms and OPENAI_AVAILABLE:
            # Use local LLM (OpenAI-compatible API) - COST-FREE
            # P0 FIX: Use sentinel value instead of "not-needed"
            self.local_client = OpenAI(
                base_url=f"{self.local_llm_url}/v1",
                api_key="local-llm-sentinel"  # Sentinel value, not user credentials
            )
            logger.info("Local LLM client initialized (llama-3.1-8b)")
        elif ANTHROPIC_AVAILABLE and self.api_key:
            # Fallback to Anthropic API ($$$ costs)
            self.client = anthropic.Anthropic(api_key=self.api_key)
            logger.info("Anthropic client initialized (Claude Sonnet 4)")

        # Model configuration
        if self.use_local_llms:
            self.generation_model = "llama-3.1-8b"  # Local model
            self.validation_model = "llama-3.1-8b"  # Same model for validation
        else:
            self.generation_model = "claude-sonnet-4-20250514"  # For code generation
            self.validation_model = "claude-haiku-4-20250514" if use_haiku_for_validation else self.generation_model

        # Template cache for learned patterns
        self._template_cache: Dict[BusinessType, Dict[str, Any]] = {}

        # Rate limiting
        self._generation_count = 0
        self._generation_window_start = 0.0
        self._max_generations_per_hour = 100  # Configurable

        # Load evolution archive if available
        self._load_evolution_archive()

    def _check_rate_limit(self) -> None:
        """Check and enforce rate limiting for product generation."""
        import time
        now = time.time()

        # Reset counter if window expired
        if now - self._generation_window_start > 3600:
            self._generation_count = 0
            self._generation_window_start = now

        # Check limit
        if self._generation_count >= self._max_generations_per_hour:
            raise ValueError(f"Rate limit exceeded: {self._max_generations_per_hour}/hour")

        # Increment counter
        self._generation_count += 1

    def _load_evolution_archive(self) -> None:
        """Load successful product templates from SE-Darwin evolution archive."""
        if not self.evolution_archive_path or not self.evolution_archive_path.exists():
            logger.debug("No evolution archive found, using default templates")
            return

        try:
            archive_file = self.evolution_archive_path / "product_templates.json"
            if archive_file.exists():
                with open(archive_file) as f:
                    archived_templates = json.load(f)
                    for btype_str, template in archived_templates.items():
                        try:
                            btype = BusinessType(btype_str)
                            self._template_cache[btype] = template
                            logger.info(f"Loaded evolved template for {btype.value}")
                        except ValueError:
                            logger.warning(f"Unknown business type in archive: {btype_str}")
        except Exception as exc:
            logger.warning(f"Failed to load evolution archive: {exc}")

    async def generate_product(
        self,
        requirements: ProductRequirements,
        use_cache: bool = True
    ) -> GeneratedProduct:
        """
        Generate a complete product based on requirements.

        Args:
            requirements: Product requirements
            use_cache: Use cached templates if available

        Returns:
            GeneratedProduct with all files and metadata

        Raises:
            ValueError: If requirements are invalid
            RuntimeError: If generation fails
        """
        import time
        start_time = time.time()

        # Route to appropriate generator
        if requirements.business_type == BusinessType.SAAS:
            product = await self.generate_saas_application(requirements, use_cache)
        elif requirements.business_type == BusinessType.CONTENT:
            product = await self.generate_content_website(requirements, use_cache)
        elif requirements.business_type == BusinessType.ECOMMERCE:
            product = await self.generate_ecommerce_store(requirements, use_cache)
        else:
            raise ValueError(f"Unsupported business type: {requirements.business_type}")

        # Add generation metadata
        product.generation_time_seconds = time.time() - start_time

        logger.info(
            f"Generated {requirements.business_type.value} product in "
            f"{product.generation_time_seconds:.2f}s with {len(product.files)} files"
        )

        return product

    async def generate_saas_application(
        self,
        requirements: ProductRequirements,
        use_cache: bool = True
    ) -> GeneratedProduct:
        """
        Generate a SaaS application: Next.js 14 + Supabase + Tailwind CSS.

        Includes:
        - Authentication (Supabase Auth)
        - Database schema
        - API routes
        - Dashboard UI
        - Billing integration (optional)

        Args:
            requirements: Product requirements
            use_cache: Use cached templates

        Returns:
            GeneratedProduct with complete SaaS application
        """
        # Check rate limit
        self._check_rate_limit()

        logger.info(f"Generating SaaS application: {requirements.name}")

        # Build prompt for Claude Sonnet 4
        prompt = self._build_saas_prompt(requirements)

        # Generate code using Claude
        generated_code = await self._call_claude_for_generation(
            prompt=prompt,
            business_type=BusinessType.SAAS,
            use_cache=use_cache
        )

        # Parse generated response into files
        files = self._parse_generated_files(generated_code)

        # Add standard configuration files
        files.update(self._generate_saas_config_files(requirements))

        # Create product
        product = GeneratedProduct(
            files=files,
            product_type=BusinessType.SAAS,
            tech_stack=[
                "Next.js 14.3.0",
                "React 18",
                "Supabase",
                "TypeScript 5.x",
                "Tailwind CSS 3.x",
                "Supabase Auth"
            ],
            setup_instructions=self._generate_saas_setup_instructions(requirements),
            environment_vars=self._generate_saas_env_vars(requirements),
            deployment_config=self._generate_vercel_config()
        )

        return product

    async def generate_content_website(
        self,
        requirements: ProductRequirements,
        use_cache: bool = True
    ) -> GeneratedProduct:
        """
        Generate a content website: Next.js 14 + MDX + Contentlayer.

        Includes:
        - Blog with MDX
        - Content management
        - SEO optimization
        - RSS feed
        - Search functionality

        Args:
            requirements: Product requirements
            use_cache: Use cached templates

        Returns:
            GeneratedProduct with complete content website
        """
        # Check rate limit
        self._check_rate_limit()

        logger.info(f"Generating content website: {requirements.name}")

        # Build prompt for Claude Sonnet 4
        prompt = self._build_content_prompt(requirements)

        # Generate code using Claude
        generated_code = await self._call_claude_for_generation(
            prompt=prompt,
            business_type=BusinessType.CONTENT,
            use_cache=use_cache
        )

        # Parse generated response into files
        files = self._parse_generated_files(generated_code)

        # Add standard configuration files
        files.update(self._generate_content_config_files(requirements))

        # Add sample content
        files.update(self._generate_sample_content(requirements))

        # Create product
        product = GeneratedProduct(
            files=files,
            product_type=BusinessType.CONTENT,
            tech_stack=[
                "Next.js 14.3.0",
                "React 18",
                "MDX",
                "Contentlayer",
                "TypeScript 5.x",
                "Tailwind CSS 3.x",
                "next-seo"
            ],
            setup_instructions=self._generate_content_setup_instructions(requirements),
            environment_vars=self._generate_content_env_vars(requirements),
            deployment_config=self._generate_vercel_config()
        )

        return product

    async def generate_ecommerce_store(
        self,
        requirements: ProductRequirements,
        use_cache: bool = True
    ) -> GeneratedProduct:
        """
        Generate an e-commerce store: Next.js 14 + Stripe + Prisma + PostgreSQL.

        Includes:
        - Product catalog
        - Shopping cart
        - Stripe checkout
        - Order management
        - Admin dashboard

        Args:
            requirements: Product requirements
            use_cache: Use cached templates

        Returns:
            GeneratedProduct with complete e-commerce store
        """
        # Check rate limit
        self._check_rate_limit()

        logger.info(f"Generating e-commerce store: {requirements.name}")

        # Build prompt for Claude Sonnet 4
        prompt = self._build_ecommerce_prompt(requirements)

        # Generate code using Claude
        generated_code = await self._call_claude_for_generation(
            prompt=prompt,
            business_type=BusinessType.ECOMMERCE,
            use_cache=use_cache
        )

        # Parse generated response into files
        files = self._parse_generated_files(generated_code)

        # Add standard configuration files
        files.update(self._generate_ecommerce_config_files(requirements))

        # Add Prisma schema
        files.update(self._generate_prisma_schema(requirements))

        # Create product
        product = GeneratedProduct(
            files=files,
            product_type=BusinessType.ECOMMERCE,
            tech_stack=[
                "Next.js 14.3.0",
                "React 18",
                "Stripe",
                "Prisma",
                "PostgreSQL",
                "TypeScript 5.x",
                "Tailwind CSS 3.x",
                "NextAuth.js"
            ],
            setup_instructions=self._generate_ecommerce_setup_instructions(requirements),
            environment_vars=self._generate_ecommerce_env_vars(requirements),
            deployment_config=self._generate_vercel_config()
        )

        return product

    # ==================== PROMPT BUILDERS ====================

    def _build_saas_prompt(self, requirements: ProductRequirements) -> str:
        """Build prompt for SaaS application generation."""
        features_text = "\n".join(f"- {feature}" for feature in requirements.features)

        prompt = f"""Generate a complete Next.js 14 SaaS application with the following requirements:

**Application Name:** {requirements.name}
**Description:** {requirements.description}
**Target Audience:** {requirements.target_audience}
**Monetization:** {requirements.monetization_model}

**Required Features:**
{features_text}

**Tech Stack:**
- Next.js 14 with App Router
- Supabase for backend (database + auth)
- TypeScript for type safety
- Tailwind CSS for styling
- Supabase Auth for authentication

**Requirements:**
1. Complete file structure with all necessary files
2. Supabase authentication (sign up, sign in, sign out)
3. Protected routes with middleware
4. Dashboard with user-specific data
5. API routes for data operations
6. Responsive UI with Tailwind CSS
7. Type-safe database queries
8. Environment variable configuration
9. Error handling and loading states
10. Production-ready code quality

**Output Format:**
Provide each file with clear markers:
```filename: path/to/file.ext
[file content]
```

Generate the complete application now. Include:
- app/layout.tsx (root layout)
- app/page.tsx (landing page)
- app/dashboard/page.tsx (dashboard)
- app/api/... (API routes)
- components/... (UI components)
- lib/supabase.ts (Supabase client)
- middleware.ts (auth middleware)
- package.json
- tsconfig.json
- tailwind.config.js
- .env.example

Make it production-ready, well-structured, and fully functional."""

        return prompt

    def _build_content_prompt(self, requirements: ProductRequirements) -> str:
        """Build prompt for content website generation."""
        features_text = "\n".join(f"- {feature}" for feature in requirements.features)

        prompt = f"""Generate a complete Next.js 14 content website with the following requirements:

**Website Name:** {requirements.name}
**Description:** {requirements.description}
**Target Audience:** {requirements.target_audience}
**Content Focus:** {requirements.monetization_model}

**Required Features:**
{features_text}

**Tech Stack:**
- Next.js 14 with App Router
- MDX for content
- Contentlayer for content management
- TypeScript for type safety
- Tailwind CSS for styling
- next-seo for SEO optimization

**Requirements:**
1. Complete file structure with all necessary files
2. Blog with MDX support
3. Content categories and tags
4. Author profiles
5. SEO metadata for all pages
6. RSS feed generation
7. Search functionality
8. Responsive design
9. Dark mode support
10. Reading time estimation

**Output Format:**
Provide each file with clear markers:
```filename: path/to/file.ext
[file content]
```

Generate the complete website now. Include:
- app/layout.tsx (root layout)
- app/page.tsx (homepage)
- app/blog/[slug]/page.tsx (blog post)
- content/posts/... (sample MDX posts)
- components/... (UI components)
- contentlayer.config.ts
- package.json
- tsconfig.json
- tailwind.config.js
- .env.example

Make it production-ready with excellent content presentation."""

        return prompt

    def _build_ecommerce_prompt(self, requirements: ProductRequirements) -> str:
        """Build prompt for e-commerce store generation."""
        features_text = "\n".join(f"- {feature}" for feature in requirements.features)

        prompt = f"""Generate a complete Next.js 14 e-commerce store with the following requirements:

**Store Name:** {requirements.name}
**Description:** {requirements.description}
**Target Audience:** {requirements.target_audience}
**Business Model:** {requirements.monetization_model}

**Required Features:**
{features_text}

**Tech Stack:**
- Next.js 14 with App Router
- Stripe for payments
- Prisma for database ORM
- PostgreSQL for data storage
- TypeScript for type safety
- Tailwind CSS for styling
- NextAuth.js for authentication

**Requirements:**
1. Complete file structure with all necessary files
2. Product catalog with categories
3. Shopping cart functionality
4. Stripe checkout integration
5. Order management system
6. User authentication
7. Admin dashboard
8. Inventory tracking
9. Order history
10. Payment webhooks

**Output Format:**
Provide each file with clear markers:
```filename: path/to/file.ext
[file content]
```

Generate the complete store now. Include:
- app/layout.tsx (root layout)
- app/page.tsx (homepage)
- app/products/[id]/page.tsx (product page)
- app/cart/page.tsx (shopping cart)
- app/checkout/page.tsx (checkout)
- app/admin/page.tsx (admin dashboard)
- app/api/... (API routes)
- components/... (UI components)
- lib/prisma.ts (Prisma client)
- lib/stripe.ts (Stripe client)
- prisma/schema.prisma (database schema)
- package.json
- tsconfig.json
- tailwind.config.js
- .env.example

Make it production-ready with secure payment handling."""

        return prompt

    # ==================== CLAUDE API INTERACTION ====================

    async def _call_claude_for_generation(
        self,
        prompt: str,
        business_type: BusinessType,
        use_cache: bool
    ) -> str:
        """
        Call Claude Sonnet 4 for code generation.

        Args:
            prompt: Generation prompt
            business_type: Type of business
            use_cache: Use cached templates

        Returns:
            Generated code as string

        Raises:
            RuntimeError: If API call fails
        """
        if not self.client and not self.local_client:
            raise RuntimeError("No LLM client initialized. Check USE_LOCAL_LLMS or API key.")

        # Check cache first
        if use_cache and business_type in self._template_cache:
            logger.info(f"Using cached template for {business_type.value}")
            return self._template_cache[business_type].get("code", "")

        try:
            if self.use_local_llms and self.local_client:
                # Use local LLM (OpenAI-compatible API) - COST-FREE
                logger.info(f"Calling local LLM (llama-3.1-8b) for {business_type.value} generation...")

                response = await asyncio.to_thread(
                    self.local_client.chat.completions.create,
                    model=self.generation_model,
                    max_tokens=16000,
                    temperature=0.3,
                    messages=[{
                        "role": "user",
                        "content": prompt
                    }]
                )

                # Extract generated code
                generated_code = response.choices[0].message.content

            else:
                # Use Anthropic API ($$$ costs)
                logger.info(f"Calling Claude Sonnet 4 for {business_type.value} generation...")

                # Call Claude API
                response = await asyncio.to_thread(
                    self.client.messages.create,
                    model=self.generation_model,
                    max_tokens=16000,  # Allow for large codebases
                    temperature=0.3,  # Lower temperature for code generation
                    messages=[{
                        "role": "user",
                        "content": prompt
                    }]
                )

                # Extract generated code
                generated_code = response.content[0].text

            # Cache successful generation
            self._template_cache[business_type] = {
                "code": generated_code,
                "quality_score": 0.0  # Will be updated after validation
            }

            logger.info(f"Generated {len(generated_code)} characters of code")

            return generated_code

        except Exception as exc:
            logger.error(f"Claude API call failed: {exc}")
            raise RuntimeError(f"Failed to generate code: {exc}")

    # ==================== FILE PARSING ====================

    def _parse_generated_files(self, generated_code: str) -> Dict[str, str]:
        """
        Parse generated code into individual files.

        Expected format:
        ```filename: path/to/file.ext
        [file content]
        ```

        Args:
            generated_code: Raw generated code from Claude

        Returns:
            Dict mapping filenames to content
        """
        files = {}
        current_file = None
        current_content = []

        for line in generated_code.split("\n"):
            # Check for file marker
            if line.startswith("```filename:") or line.startswith("```typescript:") or line.startswith("```javascript:"):
                # Save previous file
                if current_file:
                    files[current_file] = "\n".join(current_content).strip()

                # Extract filename
                if "filename:" in line:
                    current_file = line.split("filename:")[1].strip()
                else:
                    # Extract from language marker (e.g., ```typescript: app/page.tsx)
                    parts = line.split(":")
                    if len(parts) > 1:
                        current_file = parts[1].strip()
                    else:
                        current_file = None

                current_content = []

            elif line.strip() == "```" and current_file:
                # End of file block
                files[current_file] = "\n".join(current_content).strip()
                current_file = None
                current_content = []

            elif current_file:
                # Add line to current file
                current_content.append(line)

        # Save last file if any
        if current_file and current_content:
            files[current_file] = "\n".join(current_content).strip()

        logger.info(f"Parsed {len(files)} files from generated code")

        return files

    # ==================== CONFIG FILE GENERATORS ====================

    def _generate_saas_config_files(self, requirements: ProductRequirements) -> Dict[str, str]:
        """Generate standard config files for SaaS application."""
        return {
            ".gitignore": self._generate_gitignore(),
            "README.md": self._generate_saas_readme(requirements),
            ".env.example": self._generate_saas_env_example(requirements)
        }

    def _generate_content_config_files(self, requirements: ProductRequirements) -> Dict[str, str]:
        """Generate standard config files for content website."""
        return {
            ".gitignore": self._generate_gitignore(),
            "README.md": self._generate_content_readme(requirements),
            ".env.example": self._generate_content_env_example(requirements)
        }

    def _generate_ecommerce_config_files(self, requirements: ProductRequirements) -> Dict[str, str]:
        """Generate standard config files for e-commerce store."""
        return {
            ".gitignore": self._generate_gitignore(),
            "README.md": self._generate_ecommerce_readme(requirements),
            ".env.example": self._generate_ecommerce_env_example(requirements)
        }

    def _generate_gitignore(self) -> str:
        """Generate .gitignore file."""
        return """# Dependencies
node_modules
.pnp
.pnp.js

# Testing
coverage

# Next.js
.next/
out/

# Production
build
dist

# Environment
.env
.env.local
.env*.local

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Misc
*.log
.vercel
"""

    def _generate_prisma_schema(self, requirements: ProductRequirements) -> Dict[str, str]:
        """Generate Prisma schema for e-commerce."""
        schema = """generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  orders    Order[]
}

model Product {
  id          String   @id @default(cuid())
  name        String
  description String
  price       Float
  image       String?
  stock       Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  orderItems  OrderItem[]
}

model Order {
  id        String      @id @default(cuid())
  userId    String
  user      User        @relation(fields: [userId], references: [id])
  total     Float
  status    String      @default("pending")
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
  items     OrderItem[]
}

model OrderItem {
  id        String  @id @default(cuid())
  orderId   String
  order     Order   @relation(fields: [orderId], references: [id])
  productId String
  product   Product @relation(fields: [productId], references: [id])
  quantity  Int
  price     Float
}
"""
        return {"prisma/schema.prisma": schema}

    def _generate_sample_content(self, requirements: ProductRequirements) -> Dict[str, str]:
        """Generate sample MDX content for content website."""
        sample_post = f"""---
title: "Welcome to {requirements.name}"
date: "2025-01-01"
author: "Genesis Team"
description: "{requirements.description}"
tags: ["welcome", "introduction"]
---

# Welcome to {requirements.name}

This is your first blog post. Edit this file in `content/posts/welcome.mdx` to customize it.

## Getting Started

{requirements.description}

## Features

This content platform includes:

- **MDX Support**: Write content in Markdown with React components
- **SEO Optimized**: Built-in metadata and structured data
- **Fast Performance**: Static site generation for optimal speed
- **Beautiful Design**: Responsive layout with dark mode

## What's Next?

Start creating your content by adding more MDX files to the `content/posts` directory.
"""

        return {"content/posts/welcome.mdx": sample_post}

    # ==================== SETUP INSTRUCTIONS ====================

    def _generate_saas_setup_instructions(self, requirements: ProductRequirements) -> str:
        """Generate setup instructions for SaaS application."""
        return f"""# Setup Instructions for {requirements.name}

## Prerequisites
- Node.js 18+ installed
- Supabase account (free tier available)
- Vercel account for deployment (optional)

## Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Supabase:**
   - Create a new project at https://supabase.com
   - Copy your project URL and anon key
   - Create `.env.local` file:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
     ```

3. **Run development server:**
   ```bash
   npm run dev
   ```

4. **Open browser:**
   Navigate to http://localhost:3000

## Database Setup

Run the following SQL in your Supabase SQL editor:

```sql
-- Create users table
create table users (
  id uuid references auth.users not null primary key,
  email text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table users enable row level security;

-- Create policies
create policy "Users can view own data" on users for select using (auth.uid() = id);
create policy "Users can update own data" on users for update using (auth.uid() = id);
```

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Manual

```bash
npm run build
npm start
```

## Troubleshooting

- **Supabase connection error**: Verify environment variables
- **Build errors**: Run `npm ci` to clean install dependencies
- **Auth not working**: Check RLS policies in Supabase
"""

    def _generate_content_setup_instructions(self, requirements: ProductRequirements) -> str:
        """Generate setup instructions for content website."""
        return f"""# Setup Instructions for {requirements.name}

## Prerequisites
- Node.js 18+ installed
- Vercel account for deployment (optional)

## Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run development server:**
   ```bash
   npm run dev
   ```

3. **Open browser:**
   Navigate to http://localhost:3000

## Adding Content

Create MDX files in `content/posts/`:

```mdx
---
title: "Your Post Title"
date: "2025-01-01"
author: "Your Name"
description: "Post description"
tags: ["tag1", "tag2"]
---

# Your Content Here

Write your content in Markdown...
```

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Connect repository to Vercel
3. Deploy!

No environment variables needed for basic setup.
"""

    def _generate_ecommerce_setup_instructions(self, requirements: ProductRequirements) -> str:
        """Generate setup instructions for e-commerce store."""
        return f"""# Setup Instructions for {requirements.name}

## Prerequisites
- Node.js 18+ installed
- PostgreSQL database (or Vercel Postgres)
- Stripe account
- Vercel account for deployment (optional)

## Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up database:**
   - Create PostgreSQL database
   - Copy connection string
   - Create `.env.local` file:
     ```
     DATABASE_URL=your_postgres_connection_string
     STRIPE_SECRET_KEY=your_stripe_secret_key
     NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
     STRIPE_WEBHOOK_SECRET=your_webhook_secret
     ```

3. **Run Prisma migrations:**
   ```bash
   npx prisma migrate dev
   ```

4. **Seed database (optional):**
   ```bash
   npx prisma db seed
   ```

5. **Run development server:**
   ```bash
   npm run dev
   ```

6. **Open browser:**
   Navigate to http://localhost:3000

## Stripe Setup

1. Create account at https://stripe.com
2. Get API keys from dashboard
3. Set up webhook endpoint:
   - URL: `https://your-domain.com/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `payment_intent.succeeded`

## Deployment

### Vercel + Vercel Postgres

1. Push code to GitHub
2. Connect repository to Vercel
3. Add Vercel Postgres addon
4. Add environment variables
5. Deploy!

## Troubleshooting

- **Database errors**: Run `npx prisma generate` and `npx prisma migrate deploy`
- **Stripe webhook fails**: Use Stripe CLI for local testing
- **Payment not working**: Verify webhook secret is correct
"""

    # ==================== ENVIRONMENT VARIABLES ====================

    def _generate_saas_env_vars(self, requirements: ProductRequirements) -> Dict[str, str]:
        """Generate environment variables for SaaS."""
        return {
            "NEXT_PUBLIC_SUPABASE_URL": "https://your-project.supabase.co",
            "NEXT_PUBLIC_SUPABASE_ANON_KEY": "your-anon-key",
            "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key (server-side only)"
        }

    def _generate_content_env_vars(self, requirements: ProductRequirements) -> Dict[str, str]:
        """Generate environment variables for content website."""
        return {
            "NEXT_PUBLIC_SITE_URL": "https://your-site.com",
            "NEXT_PUBLIC_SITE_NAME": requirements.name
        }

    def _generate_ecommerce_env_vars(self, requirements: ProductRequirements) -> Dict[str, str]:
        """Generate environment variables for e-commerce."""
        return {
            "DATABASE_URL": "postgresql://user:pass@host:5432/db",
            "STRIPE_SECRET_KEY": "sk_test_...",
            "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": "pk_test_...",
            "STRIPE_WEBHOOK_SECRET": "whsec_...",
            "NEXTAUTH_SECRET": "your-secret-key",
            "NEXTAUTH_URL": "http://localhost:3000"
        }

    def _generate_saas_env_example(self, requirements: ProductRequirements) -> str:
        """Generate .env.example for SaaS."""
        env_vars = self._generate_saas_env_vars(requirements)
        return "\n".join(f"{key}={value}" for key, value in env_vars.items())

    def _generate_content_env_example(self, requirements: ProductRequirements) -> str:
        """Generate .env.example for content website."""
        env_vars = self._generate_content_env_vars(requirements)
        return "\n".join(f"{key}={value}" for key, value in env_vars.items())

    def _generate_ecommerce_env_example(self, requirements: ProductRequirements) -> str:
        """Generate .env.example for e-commerce."""
        env_vars = self._generate_ecommerce_env_vars(requirements)
        return "\n".join(f"{key}={value}" for key, value in env_vars.items())

    # ==================== README GENERATORS ====================

    def _generate_saas_readme(self, requirements: ProductRequirements) -> str:
        """Generate README for SaaS application."""
        return f"""# {requirements.name}

{requirements.description}

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Deployment**: Vercel

## Features

{chr(10).join(f'- {feature}' for feature in requirements.features)}

## Getting Started

See [SETUP.md](./SETUP.md) for detailed instructions.

Quick start:

```bash
npm install
npm run dev
```

## Generated by Genesis Meta-Agent

This application was autonomously generated by Genesis Meta-Agent using Claude Sonnet 4.
"""

    def _generate_content_readme(self, requirements: ProductRequirements) -> str:
        """Generate README for content website."""
        return f"""# {requirements.name}

{requirements.description}

## Tech Stack

- **Framework**: Next.js 14, React 18, TypeScript
- **Content**: MDX, Contentlayer
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## Features

{chr(10).join(f'- {feature}' for feature in requirements.features)}

## Getting Started

See [SETUP.md](./SETUP.md) for detailed instructions.

Quick start:

```bash
npm install
npm run dev
```

## Generated by Genesis Meta-Agent

This website was autonomously generated by Genesis Meta-Agent using Claude Sonnet 4.
"""

    def _generate_ecommerce_readme(self, requirements: ProductRequirements) -> str:
        """Generate README for e-commerce store."""
        return f"""# {requirements.name}

{requirements.description}

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Prisma, PostgreSQL
- **Payments**: Stripe
- **Auth**: NextAuth.js
- **Deployment**: Vercel

## Features

{chr(10).join(f'- {feature}' for feature in requirements.features)}

## Getting Started

See [SETUP.md](./SETUP.md) for detailed instructions.

Quick start:

```bash
npm install
npx prisma migrate dev
npm run dev
```

## Generated by Genesis Meta-Agent

This store was autonomously generated by Genesis Meta-Agent using Claude Sonnet 4.
"""

    # ==================== DEPLOYMENT CONFIG ====================

    def _generate_vercel_config(self) -> Dict[str, Any]:
        """Generate Vercel deployment configuration."""
        return {
            "vercel.json": {
                "buildCommand": "npm run build",
                "outputDirectory": ".next",
                "framework": "nextjs",
                "installCommand": "npm install"
            }
        }
