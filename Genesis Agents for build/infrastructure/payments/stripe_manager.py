"""
Stripe Manager - Autonomous Payment Processing for Genesis Businesses
======================================================================

Handles all Stripe operations for autonomous businesses:
- Stripe Connect account creation (for business payouts)
- Product and price creation
- Checkout session management
- Webhook processing (payment success, refunds, disputes)
- Revenue tracking per business
- Automated payout handling

Architecture:
- Stripe Connect for multi-tenant payments (each business gets own account)
- Webhooks for asynchronous event processing
- Revenue tracking with MongoDB persistence
- Automatic payout scheduling
"""

import hashlib
import hmac
import json
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Stripe SDK (optional dependency)
try:
    import stripe
    HAS_STRIPE = True
except ImportError:
    HAS_STRIPE = False
    logger.warning("stripe not installed - payment features unavailable")

# MongoDB (optional for revenue tracking)
try:
    from pymongo import MongoClient
    HAS_MONGODB = True
except ImportError:
    HAS_MONGODB = False
    logger.warning("pymongo not installed - revenue tracking will use in-memory storage")


class PaymentStatus(Enum):
    """Payment lifecycle status."""
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    REFUNDED = "refunded"
    DISPUTED = "disputed"
    CANCELLED = "cancelled"


@dataclass
class StripeAccount:
    """Stripe Connect account for a business."""
    account_id: str  # Stripe Connect account ID
    business_id: str
    business_name: str
    email: str
    country: str = "US"
    currency: str = "usd"
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    charges_enabled: bool = False
    payouts_enabled: bool = False
    verification_status: str = "unverified"


@dataclass
class StripeProduct:
    """Stripe product for a business."""
    product_id: str  # Stripe product ID
    price_id: str  # Stripe price ID
    business_id: str
    name: str
    description: str
    price_cents: int
    currency: str = "usd"
    interval: str = "month"  # month, year, one_time
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class StripeCheckoutSession:
    """Stripe checkout session."""
    session_id: str
    business_id: str
    product_id: str
    customer_email: Optional[str] = None
    amount_total: int = 0
    currency: str = "usd"
    status: PaymentStatus = PaymentStatus.PENDING
    payment_intent_id: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None


@dataclass
class WebhookEvent:
    """Stripe webhook event."""
    event_id: str
    event_type: str
    business_id: Optional[str] = None
    payment_intent_id: Optional[str] = None
    amount: int = 0
    currency: str = "usd"
    status: str = "received"
    processed_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    data: Dict[str, Any] = field(default_factory=dict)


class StripeManager:
    """
    Manages all Stripe operations for autonomous businesses.
    
    Features:
    - Stripe Connect account creation (Express accounts)
    - Product and price management
    - Checkout session creation
    - Webhook event processing
    - Revenue tracking and reporting
    - Automated payout handling
    
    Usage:
        manager = StripeManager(api_key="sk_test_...")
        account = await manager.create_connect_account(business_id, business_name, email)
        product = await manager.create_product(business_id, name, price_cents)
        session = await manager.create_checkout_session(product_id, customer_email)
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        webhook_secret: Optional[str] = None,
        mongodb_uri: Optional[str] = None,
        enable_payouts: bool = True
    ):
        """
        Initialize Stripe manager.
        
        Args:
            api_key: Stripe secret key (defaults to STRIPE_SECRET_KEY env var)
            webhook_secret: Stripe webhook secret (defaults to STRIPE_WEBHOOK_SECRET)
            mongodb_uri: MongoDB URI for revenue tracking
            enable_payouts: Enable automated payouts
        """
        self.api_key = api_key or os.getenv("STRIPE_SECRET_KEY")
        self.webhook_secret = webhook_secret or os.getenv("STRIPE_WEBHOOK_SECRET")
        self.enable_payouts = enable_payouts
        
        if not self.api_key:
            logger.warning("No Stripe API key provided - payment features disabled")
            self._stripe_enabled = False
        else:
            if HAS_STRIPE:
                stripe.api_key = self.api_key
                self._stripe_enabled = True
                logger.info("Stripe manager initialized")
            else:
                logger.error("stripe library not installed")
                self._stripe_enabled = False
        
        # MongoDB for revenue tracking
        self.mongo_client = None
        self.db = None
        if HAS_MONGODB and mongodb_uri:
            try:
                self.mongo_client = MongoClient(mongodb_uri, serverSelectionTimeoutMS=5000)
                self.db = self.mongo_client.genesis_payments
                self.mongo_client.admin.command('ping')
                logger.info("MongoDB connected for revenue tracking")
            except Exception as e:
                logger.warning(f"MongoDB connection failed: {e} - using in-memory tracking")
        
        # In-memory storage (fallback)
        self._accounts: Dict[str, StripeAccount] = {}
        self._products: Dict[str, StripeProduct] = {}
        self._sessions: Dict[str, StripeCheckoutSession] = {}
        self._revenue_by_business: Dict[str, float] = {}
    
    # ========================================================================
    # STRIPE CONNECT - Account Creation
    # ========================================================================
    
    async def create_connect_account(
        self,
        business_id: str,
        business_name: str,
        email: str,
        country: str = "US"
    ) -> StripeAccount:
        """
        Create Stripe Connect Express account for a business.
        
        Args:
            business_id: Genesis business ID
            business_name: Business name
            email: Business email
            country: Country code (ISO 3166-1 alpha-2)
        
        Returns:
            StripeAccount object
        
        Raises:
            RuntimeError: If Stripe API call fails
        """
        if not self._stripe_enabled:
            raise RuntimeError("Stripe not enabled - check API key")
        
        logger.info(f"Creating Stripe Connect account for business {business_id}")
        
        try:
            # Create Stripe Connect Express account
            account = stripe.Account.create(
                type="express",
                country=country,
                email=email,
                business_type="company",
                business_profile={
                    "name": business_name,
                    "support_email": email,
                },
                capabilities={
                    "card_payments": {"requested": True},
                    "transfers": {"requested": True},
                },
                metadata={
                    "genesis_business_id": business_id,
                    "created_by": "genesis_meta_agent"
                }
            )
            
            # Create account object
            stripe_account = StripeAccount(
                account_id=account.id,
                business_id=business_id,
                business_name=business_name,
                email=email,
                country=country,
                charges_enabled=account.charges_enabled,
                payouts_enabled=account.payouts_enabled,
                verification_status="pending"
            )
            
            # Store in memory and MongoDB
            self._accounts[business_id] = stripe_account
            if self.db:
                self.db.connect_accounts.insert_one(vars(stripe_account))
            
            logger.info(f"Stripe Connect account created: {account.id}")
            
            return stripe_account
            
        except Exception as e:
            logger.error(f"Failed to create Stripe Connect account: {e}")
            raise RuntimeError(f"Stripe Connect account creation failed: {e}")
    
    async def get_account_onboarding_link(
        self,
        business_id: str,
        return_url: str,
        refresh_url: str
    ) -> str:
        """
        Generate Stripe Connect onboarding link for business.
        
        Args:
            business_id: Genesis business ID
            return_url: URL to redirect after onboarding
            refresh_url: URL to redirect if onboarding expires
        
        Returns:
            Onboarding URL
        """
        if not self._stripe_enabled:
            raise RuntimeError("Stripe not enabled")
        
        account = self._accounts.get(business_id)
        if not account:
            raise ValueError(f"No Stripe account found for business {business_id}")
        
        try:
            link = stripe.AccountLink.create(
                account=account.account_id,
                refresh_url=refresh_url,
                return_url=return_url,
                type="account_onboarding",
            )
            
            logger.info(f"Generated onboarding link for {business_id}")
            return link.url
            
        except Exception as e:
            logger.error(f"Failed to create onboarding link: {e}")
            raise RuntimeError(f"Onboarding link creation failed: {e}")
    
    # ========================================================================
    # PRODUCT & PRICE CREATION
    # ========================================================================
    
    async def create_product(
        self,
        business_id: str,
        name: str,
        description: str,
        price_cents: int,
        currency: str = "usd",
        interval: str = "month"  # month, year, one_time
    ) -> StripeProduct:
        """
        Create Stripe product and price for a business.
        
        Args:
            business_id: Genesis business ID
            name: Product name
            description: Product description
            price_cents: Price in cents
            currency: Currency code (ISO 4217)
            interval: Billing interval (month, year, one_time)
        
        Returns:
            StripeProduct object
        
        Raises:
            RuntimeError: If Stripe API call fails
        """
        if not self._stripe_enabled:
            raise RuntimeError("Stripe not enabled")
        
        logger.info(f"Creating Stripe product '{name}' for business {business_id}")
        
        try:
            # Create product
            product = stripe.Product.create(
                name=name,
                description=description,
                metadata={
                    "genesis_business_id": business_id,
                }
            )
            
            # Create price
            if interval == "one_time":
                price = stripe.Price.create(
                    product=product.id,
                    unit_amount=price_cents,
                    currency=currency,
                    metadata={
                        "genesis_business_id": business_id,
                    }
                )
            else:
                price = stripe.Price.create(
                    product=product.id,
                    unit_amount=price_cents,
                    currency=currency,
                    recurring={"interval": interval},
                    metadata={
                        "genesis_business_id": business_id,
                    }
                )
            
            # Create product object
            stripe_product = StripeProduct(
                product_id=product.id,
                price_id=price.id,
                business_id=business_id,
                name=name,
                description=description,
                price_cents=price_cents,
                currency=currency,
                interval=interval
            )
            
            # Store in memory and MongoDB
            product_key = f"{business_id}:{product.id}"
            self._products[product_key] = stripe_product
            if self.db:
                self.db.products.insert_one(vars(stripe_product))
            
            logger.info(f"Stripe product created: {product.id} (price: {price.id})")
            
            return stripe_product
            
        except Exception as e:
            logger.error(f"Failed to create Stripe product: {e}")
            raise RuntimeError(f"Stripe product creation failed: {e}")
    
    # ========================================================================
    # CHECKOUT SESSION
    # ========================================================================
    
    async def create_checkout_session(
        self,
        business_id: str,
        price_id: str,
        success_url: str,
        cancel_url: str,
        customer_email: Optional[str] = None,
        quantity: int = 1
    ) -> StripeCheckoutSession:
        """
        Create Stripe checkout session for payment.
        
        Args:
            business_id: Genesis business ID
            price_id: Stripe price ID
            success_url: URL to redirect after successful payment
            cancel_url: URL to redirect on cancellation
            customer_email: Optional customer email
            quantity: Quantity of items
        
        Returns:
            StripeCheckoutSession object
        """
        if not self._stripe_enabled:
            raise RuntimeError("Stripe not enabled")
        
        logger.info(f"Creating checkout session for business {business_id}")
        
        try:
            # Get Connect account for this business
            account = self._accounts.get(business_id)
            
            # Create checkout session
            session_params = {
                "mode": "payment",  # or "subscription" based on product type
                "line_items": [{
                    "price": price_id,
                    "quantity": quantity,
                }],
                "success_url": success_url,
                "cancel_url": cancel_url,
                "metadata": {
                    "genesis_business_id": business_id,
                }
            }
            
            if customer_email:
                session_params["customer_email"] = customer_email
            
            # If Connect account exists, create session on their behalf
            if account:
                session_params["stripe_account"] = account.account_id
            
            session = stripe.checkout.Session.create(**session_params)
            
            # Create session object
            checkout_session = StripeCheckoutSession(
                session_id=session.id,
                business_id=business_id,
                product_id=price_id,
                customer_email=customer_email,
                amount_total=session.amount_total or 0,
                currency=session.currency or "usd",
                status=PaymentStatus.PENDING,
                payment_intent_id=session.payment_intent
            )
            
            # Store in memory and MongoDB
            self._sessions[session.id] = checkout_session
            if self.db:
                self.db.checkout_sessions.insert_one(vars(checkout_session))
            
            logger.info(f"Checkout session created: {session.id}")
            
            return checkout_session
            
        except Exception as e:
            logger.error(f"Failed to create checkout session: {e}")
            raise RuntimeError(f"Checkout session creation failed: {e}")
    
    # ========================================================================
    # WEBHOOK HANDLING
    # ========================================================================
    
    async def process_webhook(
        self,
        payload: bytes,
        signature_header: str
    ) -> WebhookEvent:
        """
        Process Stripe webhook event.
        
        Args:
            payload: Raw webhook payload
            signature_header: Stripe-Signature header value
        
        Returns:
            WebhookEvent object
        
        Raises:
            ValueError: If signature verification fails
            RuntimeError: If event processing fails
        """
        if not self._stripe_enabled:
            raise RuntimeError("Stripe not enabled")
        
        if not self.webhook_secret:
            logger.warning("Webhook secret not configured - skipping signature verification")
            event = stripe.Event.construct_from(json.loads(payload), stripe.api_key)
        else:
            try:
                # Verify webhook signature
                event = stripe.Webhook.construct_event(
                    payload, signature_header, self.webhook_secret
                )
            except ValueError as e:
                logger.error(f"Invalid webhook payload: {e}")
                raise ValueError(f"Invalid webhook payload: {e}")
            except stripe.error.SignatureVerificationError as e:
                logger.error(f"Invalid webhook signature: {e}")
                raise ValueError(f"Invalid webhook signature: {e}")
        
        logger.info(f"Processing webhook event: {event['type']}")
        
        # Extract business ID from metadata
        business_id = self._extract_business_id_from_event(event)
        
        # Create webhook event object
        webhook_event = WebhookEvent(
            event_id=event['id'],
            event_type=event['type'],
            business_id=business_id,
            data=event['data']['object']
        )
        
        # Route to appropriate handler
        if event['type'] == 'checkout.session.completed':
            await self._handle_checkout_completed(event, business_id)
        elif event['type'] == 'payment_intent.succeeded':
            await self._handle_payment_succeeded(event, business_id)
        elif event['type'] == 'payment_intent.payment_failed':
            await self._handle_payment_failed(event, business_id)
        elif event['type'] == 'charge.refunded':
            await self._handle_refund(event, business_id)
        elif event['type'] == 'charge.dispute.created':
            await self._handle_dispute(event, business_id)
        else:
            logger.debug(f"Unhandled webhook event type: {event['type']}")
        
        # Store webhook event
        if self.db:
            self.db.webhook_events.insert_one(vars(webhook_event))
        
        webhook_event.status = "processed"
        return webhook_event
    
    async def _handle_checkout_completed(self, event: Dict, business_id: Optional[str]):
        """Handle checkout.session.completed event."""
        session_data = event['data']['object']
        session_id = session_data['id']
        
        # Update session status
        if session_id in self._sessions:
            self._sessions[session_id].status = PaymentStatus.SUCCEEDED
            self._sessions[session_id].completed_at = datetime.now(timezone.utc).isoformat()
        
        logger.info(f"Checkout completed: {session_id}")
    
    async def _handle_payment_succeeded(self, event: Dict, business_id: Optional[str]):
        """Handle payment_intent.succeeded event."""
        payment_intent = event['data']['object']
        amount = payment_intent['amount']
        
        # Track revenue
        if business_id:
            await self.track_revenue(
                business_id=business_id,
                amount_cents=amount,
                currency=payment_intent['currency'],
                payment_intent_id=payment_intent['id']
            )
        
        logger.info(f"Payment succeeded: ${amount/100:.2f}")
    
    async def _handle_payment_failed(self, event: Dict, business_id: Optional[str]):
        """Handle payment_intent.payment_failed event."""
        payment_intent = event['data']['object']
        error_message = payment_intent.get('last_payment_error', {}).get('message', 'Unknown error')
        
        logger.warning(f"Payment failed for business {business_id}: {error_message}")
    
    async def _handle_refund(self, event: Dict, business_id: Optional[str]):
        """Handle charge.refunded event."""
        charge = event['data']['object']
        refund_amount = charge['amount_refunded']
        
        # Deduct from revenue
        if business_id:
            await self.track_revenue(
                business_id=business_id,
                amount_cents=-refund_amount,  # Negative for refund
                currency=charge['currency'],
                payment_intent_id=charge['payment_intent']
            )
        
        logger.info(f"Refund processed: ${refund_amount/100:.2f}")
    
    async def _handle_dispute(self, event: Dict, business_id: Optional[str]):
        """Handle charge.dispute.created event."""
        dispute = event['data']['object']
        amount = dispute['amount']
        reason = dispute['reason']
        
        logger.warning(f"Dispute created for business {business_id}: ${amount/100:.2f} - {reason}")
        
        # Store dispute for review
        if self.db:
            self.db.disputes.insert_one({
                "business_id": business_id,
                "dispute_id": dispute['id'],
                "amount": amount,
                "reason": reason,
                "status": dispute['status'],
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    def _extract_business_id_from_event(self, event: Dict) -> Optional[str]:
        """Extract business ID from webhook event metadata."""
        data_object = event['data']['object']
        
        # Try metadata first
        metadata = data_object.get('metadata', {})
        if 'genesis_business_id' in metadata:
            return metadata['genesis_business_id']
        
        # Try payment intent metadata
        if 'payment_intent' in data_object:
            pi_id = data_object['payment_intent']
            try:
                pi = stripe.PaymentIntent.retrieve(pi_id)
                if pi.metadata and 'genesis_business_id' in pi.metadata:
                    return pi.metadata['genesis_business_id']
            except:
                pass
        
        return None
    
    # ========================================================================
    # REVENUE TRACKING
    # ========================================================================
    
    async def track_revenue(
        self,
        business_id: str,
        amount_cents: int,
        currency: str = "usd",
        payment_intent_id: Optional[str] = None
    ):
        """
        Track revenue for a business.
        
        Args:
            business_id: Genesis business ID
            amount_cents: Amount in cents (negative for refunds)
            currency: Currency code
            payment_intent_id: Optional payment intent ID for tracking
        """
        amount_usd = amount_cents / 100.0
        
        # Update in-memory tracker
        if business_id not in self._revenue_by_business:
            self._revenue_by_business[business_id] = 0.0
        self._revenue_by_business[business_id] += amount_usd
        
        # Store in MongoDB
        if self.db:
            self.db.revenue_events.insert_one({
                "business_id": business_id,
                "amount_cents": amount_cents,
                "amount_usd": amount_usd,
                "currency": currency,
                "payment_intent_id": payment_intent_id,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        
        logger.info(f"Revenue tracked for {business_id}: ${amount_usd:.2f}")
    
    async def get_revenue(
        self,
        business_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Get revenue for a business within date range.
        
        Args:
            business_id: Genesis business ID
            start_date: Optional start date
            end_date: Optional end date
        
        Returns:
            Revenue summary dict
        """
        # Query MongoDB if available
        if self.db:
            query = {"business_id": business_id}
            if start_date:
                query["timestamp"] = {"$gte": start_date.isoformat()}
            if end_date:
                if "timestamp" in query:
                    query["timestamp"]["$lte"] = end_date.isoformat()
                else:
                    query["timestamp"] = {"$lte": end_date.isoformat()}
            
            events = list(self.db.revenue_events.find(query))
            
            total_revenue = sum(e['amount_usd'] for e in events)
            payment_count = len([e for e in events if e['amount_cents'] > 0])
            refund_count = len([e for e in events if e['amount_cents'] < 0])
            
            return {
                "business_id": business_id,
                "total_revenue": total_revenue,
                "payment_count": payment_count,
                "refund_count": refund_count,
                "events": events
            }
        
        # Fallback to in-memory
        return {
            "business_id": business_id,
            "total_revenue": self._revenue_by_business.get(business_id, 0.0),
            "payment_count": 0,  # Not tracked in memory
            "refund_count": 0,
            "events": []
        }
    
    # ========================================================================
    # PAYOUT AUTOMATION
    # ========================================================================
    
    async def schedule_payout(
        self,
        business_id: str,
        amount_cents: int,
        currency: str = "usd"
    ) -> Dict[str, Any]:
        """
        Schedule payout to business Stripe Connect account.
        
        Args:
            business_id: Genesis business ID
            amount_cents: Amount to payout in cents
            currency: Currency code
        
        Returns:
            Payout details
        
        Raises:
            RuntimeError: If payout fails
        """
        if not self._stripe_enabled or not self.enable_payouts:
            raise RuntimeError("Payouts not enabled")
        
        account = self._accounts.get(business_id)
        if not account:
            raise ValueError(f"No Stripe account found for business {business_id}")
        
        if not account.payouts_enabled:
            raise RuntimeError(f"Payouts not enabled for account {account.account_id}")
        
        try:
            # Create payout
            payout = stripe.Payout.create(
                amount=amount_cents,
                currency=currency,
                metadata={
                    "genesis_business_id": business_id,
                },
                stripe_account=account.account_id
            )
            
            logger.info(f"Payout scheduled for {business_id}: ${amount_cents/100:.2f}")
            
            return {
                "payout_id": payout.id,
                "business_id": business_id,
                "amount": amount_cents / 100.0,
                "currency": currency,
                "status": payout.status,
                "arrival_date": payout.arrival_date
            }
            
        except Exception as e:
            logger.error(f"Failed to schedule payout: {e}")
            raise RuntimeError(f"Payout failed: {e}")
    
    async def process_automatic_payouts(self) -> List[Dict[str, Any]]:
        """
        Process automatic payouts for all businesses with sufficient balance.
        
        Returns:
            List of payout results
        """
        if not self.enable_payouts:
            logger.info("Automatic payouts disabled")
            return []
        
        payouts = []
        
        for business_id, revenue in self._revenue_by_business.items():
            # Payout if revenue > $100
            if revenue >= 100.0:
                try:
                    payout = await self.schedule_payout(
                        business_id=business_id,
                        amount_cents=int(revenue * 100),
                        currency="usd"
                    )
                    payouts.append(payout)
                    
                    # Reset revenue after payout
                    self._revenue_by_business[business_id] = 0.0
                    
                except Exception as e:
                    logger.error(f"Auto-payout failed for {business_id}: {e}")
        
        logger.info(f"Processed {len(payouts)} automatic payouts")
        return payouts
    
    # ========================================================================
    # UTILITIES
    # ========================================================================
    
    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        """
        Verify Stripe webhook signature.
        
        Args:
            payload: Raw webhook payload
            signature: Stripe-Signature header value
        
        Returns:
            True if signature is valid
        """
        if not self.webhook_secret:
            logger.warning("Webhook secret not configured - cannot verify signature")
            return False
        
        try:
            stripe.Webhook.construct_event(payload, signature, self.webhook_secret)
            return True
        except:
            return False
    
    async def get_business_balance(self, business_id: str) -> Dict[str, Any]:
        """
        Get Stripe balance for a business Connect account.
        
        Args:
            business_id: Genesis business ID
        
        Returns:
            Balance information
        """
        if not self._stripe_enabled:
            raise RuntimeError("Stripe not enabled")
        
        account = self._accounts.get(business_id)
        if not account:
            raise ValueError(f"No Stripe account found for business {business_id}")
        
        try:
            balance = stripe.Balance.retrieve(stripe_account=account.account_id)
            
            return {
                "business_id": business_id,
                "available": [
                    {"amount": bal.amount / 100.0, "currency": bal.currency}
                    for bal in balance.available
                ],
                "pending": [
                    {"amount": bal.amount / 100.0, "currency": bal.currency}
                    for bal in balance.pending
                ]
            }
        except Exception as e:
            logger.error(f"Failed to retrieve balance: {e}")
            raise RuntimeError(f"Balance retrieval failed: {e}")

