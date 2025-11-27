"""
Mailgun Email Client

Adapter for Mailgun API (alternative to SendGrid).
Provides same interface as SendGrid for easy drop-in replacement.
"""

import os
import logging
import requests
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class MailgunClient:
    """
    Mailgun API client for sending emails.
    
    Usage:
        client = MailgunClient()
        client.send_email(
            to="user@example.com",
            subject="Welcome!",
            html="<h1>Welcome to our service</h1>"
        )
    """
    
    def __init__(self, api_key: Optional[str] = None, domain: Optional[str] = None):
        """
        Initialize Mailgun client.
        
        Args:
            api_key: Mailgun API key (or from MAILGUN_API_KEY env var)
            domain: Mailgun domain (or from MAILGUN_DOMAIN env var)
        """
        self.api_key = api_key or os.getenv('MAILGUN_API_KEY')
        self.domain = domain or os.getenv('MAILGUN_DOMAIN', 'mg.yourdomain.com')
        
        if not self.api_key:
            logger.warning("MAILGUN_API_KEY not set - email sending disabled")
            self.enabled = False
        else:
            self.enabled = True
            logger.info(f"Mailgun client initialized (domain={self.domain})")
    
    def send_email(
        self,
        to: str | List[str],
        subject: str,
        text: Optional[str] = None,
        html: Optional[str] = None,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None,
        reply_to: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send an email via Mailgun.
        
        Args:
            to: Recipient email(s)
            subject: Email subject
            text: Plain text content
            html: HTML content
            from_email: Sender email
            from_name: Sender name
            reply_to: Reply-to email
        
        Returns:
            Response dict with message ID and status
        """
        if not self.enabled:
            logger.warning(f"Email not sent (Mailgun disabled): {subject}")
            return {"status": "disabled", "message": "Mailgun API key not configured"}
        
        # Prepare sender
        if from_email is None:
            from_email = f"noreply@{self.domain}"
        
        if from_name:
            from_field = f"{from_name} <{from_email}>"
        else:
            from_field = from_email
        
        # Convert to list if string
        if isinstance(to, str):
            to = [to]
        
        # Prepare data
        data = {
            "from": from_field,
            "to": to,
            "subject": subject
        }
        
        if text:
            data["text"] = text
        if html:
            data["html"] = html
        if reply_to:
            data["h:Reply-To"] = reply_to
        
        # Send via Mailgun API
        try:
            response = requests.post(
                f"https://api.mailgun.net/v3/{self.domain}/messages",
                auth=("api", self.api_key),
                data=data,
                timeout=10
            )
            
            response.raise_for_status()
            result = response.json()
            
            logger.info(f"Email sent via Mailgun: {subject} -> {to}")
            return {
                "status": "sent",
                "message_id": result.get("id"),
                "message": result.get("message")
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to send email via Mailgun: {e}")
            return {
                "status": "failed",
                "error": str(e)
            }
    
    def send_template_email(
        self,
        to: str | List[str],
        template_name: str,
        template_data: Dict[str, Any],
        subject: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send email using Mailgun template.
        
        Args:
            to: Recipient email(s)
            template_name: Mailgun template name
            template_data: Variables for template
            subject: Optional subject override
        
        Returns:
            Response dict
        """
        if not self.enabled:
            return {"status": "disabled"}
        
        # Convert to list if string
        if isinstance(to, str):
            to = [to]
        
        # Prepare data
        data = {
            "from": f"noreply@{self.domain}",
            "to": to,
            "template": template_name,
            "h:X-Mailgun-Variables": json.dumps(template_data)
        }
        
        if subject:
            data["subject"] = subject
        
        try:
            response = requests.post(
                f"https://api.mailgun.net/v3/{self.domain}/messages",
                auth=("api", self.api_key),
                data=data,
                timeout=10
            )
            
            response.raise_for_status()
            result = response.json()
            
            logger.info(f"Template email sent: {template_name} -> {to}")
            return {
                "status": "sent",
                "message_id": result.get("id")
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to send template email: {e}")
            return {
                "status": "failed",
                "error": str(e)
            }


# Singleton
_mailgun_client: Optional[MailgunClient] = None


def get_mailgun_client() -> MailgunClient:
    """Get or create the global Mailgun client."""
    global _mailgun_client
    if _mailgun_client is None:
        _mailgun_client = MailgunClient()
    return _mailgun_client


# Compatibility aliases for SendGrid migration
def send_email(to, subject, html=None, text=None):
    """SendGrid-compatible wrapper."""
    client = get_mailgun_client()
    return client.send_email(to=to, subject=subject, html=html, text=text)


if __name__ == "__main__":
    # Test Mailgun client
    import json
    
    client = MailgunClient()
    
    print("\n" + "="*80)
    print(" "*30 + "Mailgun Client Test" + " "*31)
    print("="*80 + "\n")
    
    if not client.enabled:
        print("❌ Mailgun not configured")
        print("\nTo enable:")
        print("  export MAILGUN_API_KEY=your_key_here")
        print("  export MAILGUN_DOMAIN=mg.yourdomain.com")
    else:
        print("✅ Mailgun configured")
        print(f"   Domain: {client.domain}")
        print(f"   API Key: {client.api_key[:20]}...")
        
        # Test send (won't actually send without valid domain)
        print("\n📧 Test email send:")
        result = client.send_email(
            to="test@example.com",
            subject="Test Email from Genesis",
            text="This is a test email from Genesis autonomous system.",
            html="<h1>Test Email</h1><p>From Genesis autonomous system</p>"
        )
        
        print(f"   Status: {result.get('status')}")
        if result.get('message_id'):
            print(f"   Message ID: {result.get('message_id')}")
        if result.get('error'):
            print(f"   Error: {result.get('error')}")

