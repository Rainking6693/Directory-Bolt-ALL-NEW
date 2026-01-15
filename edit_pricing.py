from pathlib import Path
path = Path('components/PricingPageOld.jsx')
text = path.read_text(encoding='utf-8')
import_stmt = "import { MONEY_BACK_LABEL, TRIAL_DAYS, TRIAL_LABEL } from '../lib/pricing/constants'\n"
if import_stmt not in text:
    text = text.replace("import { useState, useEffect } from 'react'\nimport { useRouter } from 'next/router'\n", "import { useState, useEffect } from 'react'\nimport { useRouter } from 'next/router'\n" + import_stmt)
text = text.replace("'14-day free trial'", 'TRIAL_LABEL')
text = text.replace("feature.includes('14-day free trial')", 'feature.includes(TRIAL_LABEL)')
text = text.replace("feature.replace('14-day free trial'", "feature.replace(TRIAL_LABEL")
text = text.replace("<span className=\"text-secondary-400\">Join 500+ businesses already crushing their competition</span>\n", "<span className=\"text-secondary-400\">Join 500+ businesses already crushing their competition</span>\n")
text = text.replace("<span className=\"text-secondary-400\">Full access to all features for 14 days, including AI optimization and premium directory submissions.</span>", f"<span className=\"text-secondary-400\">Full access to all features for {TRIAL_DAYS} days, including AI optimization and premium directory submissions.</span>")
text = text.replace("<span className=\"text-secondary-400\">Start Free Analysis</span>", "<span className=\"text-secondary-400\">Start Free Analysis</span>")
text = text.replace("<span>30-day money-back guarantee</span>", f"<span>{MONEY_BACK_LABEL}</span>")
text = text.replace("<span>? 30-day money-back guarantee</span>", f"<span>? {MONEY_BACK_LABEL}</span>")
text = text.replace("<p className=\"text-3xl font-bold text-center mb-12\">\n", "<p className=\"text-3xl font-bold text-center mb-12\">\n")
path.write_text(text, encoding='utf-8')
