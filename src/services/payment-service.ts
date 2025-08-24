// Payment Processing Service with Stripe Integration

import type { 
  CloudflareBindings, 
  Payment,
  Quote,
  Merchant,
  Customer
} from '../types';
import { createPerformanceTracker } from '../lib/monitoring/performance-tracker';
import Stripe from 'stripe';

export class PaymentService {
  private env: CloudflareBindings;
  private stripe: Stripe;
  private merchant: Merchant;
  private tracker: ReturnType<typeof createPerformanceTracker>;

  constructor(env: CloudflareBindings, merchant: Merchant) {
    this.env = env;
    this.merchant = merchant;
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-12-18.acacia'
    });
    this.tracker = createPerformanceTracker(env.DB, merchant.id);
  }

  // Create payment intent and generate payment link
  async createPaymentLink(
    quote: Quote,
    customer: Customer
  ): Promise<{ paymentLink: string; paymentIntentId: string }> {
    const startTime = Date.now();

    try {
      // Track payment initiation
      await this.tracker.trackEvent('payment_initiated', true, {
        quote_id: quote.id,
        amount: quote.total_amount
      });

      // Create or retrieve Stripe customer
      let stripeCustomer: Stripe.Customer;
      if (customer.metadata?.stripe_customer_id) {
        stripeCustomer = await this.stripe.customers.retrieve(
          customer.metadata.stripe_customer_id
        ) as Stripe.Customer;
      } else {
        stripeCustomer = await this.stripe.customers.create({
          phone: customer.phone_number,
          name: customer.name,
          email: customer.email,
          metadata: {
            merchant_id: this.merchant.id,
            customer_id: customer.id
          }
        });

        // Update customer with Stripe ID
        await this.env.DB.prepare(`
          UPDATE customers 
          SET metadata = json_set(metadata, '$.stripe_customer_id', ?)
          WHERE id = ?
        `).bind(stripeCustomer.id, customer.id).run();
      }

      // Create payment intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(quote.total_amount * 100), // Convert to cents
        currency: 'usd',
        customer: stripeCustomer.id,
        metadata: {
          quote_id: quote.id,
          merchant_id: this.merchant.id,
          quote_number: quote.quote_number
        },
        description: `Payment for Quote #${quote.quote_number}`,
        automatic_payment_methods: {
          enabled: true
        }
      });

      // Create payment link session
      const session = await this.stripe.checkout.sessions.create({
        customer: stripeCustomer.id,
        line_items: quote.items.map(item => ({
          price_data: {
            currency: 'usd',
            product_data: {
              name: item.description,
              description: item.notes
            },
            unit_amount: Math.round(item.unit_price * 100)
          },
          quantity: Math.round(item.quantity)
        })),
        mode: 'payment',
        payment_intent_data: {
          metadata: {
            quote_id: quote.id,
            merchant_id: this.merchant.id
          }
        },
        success_url: `https://snapquote.app/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `https://snapquote.app/payment/cancel?quote=${quote.quote_number}`,
        metadata: {
          quote_id: quote.id,
          merchant_id: this.merchant.id
        },
        expires_at: Math.floor(new Date(quote.valid_until || Date.now() + 7 * 24 * 60 * 60 * 1000).getTime() / 1000)
      });

      // Store payment record
      const paymentId = crypto.randomUUID();
      const processingTime = Date.now() - startTime;

      await this.env.DB.prepare(`
        INSERT INTO payments (
          id, quote_id, merchant_id, customer_id, amount,
          status, stripe_payment_intent_id, processing_time_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        paymentId,
        quote.id,
        this.merchant.id,
        customer.id,
        quote.total_amount,
        'pending',
        paymentIntent.id,
        processingTime
      ).run();

      // Update quote with payment information
      await this.env.DB.prepare(`
        UPDATE quotes 
        SET payment_link = ?, 
            stripe_payment_intent_id = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).bind(session.url, paymentIntent.id, quote.id).run();

      // Track performance
      await this.tracker.trackMetric('payment_link_generation_time', processingTime, {
        quote_id: quote.id
      });

      return {
        paymentLink: session.url!,
        paymentIntentId: paymentIntent.id
      };

    } catch (error) {
      console.error('Payment link creation error:', error);
      
      await this.tracker.trackPaymentFlow(
        quote.id,
        false,
        quote.total_amount,
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      throw error;
    }
  }

  // Process Stripe webhook events
  async processWebhook(
    signature: string,
    rawBody: string
  ): Promise<void> {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw new Error('Invalid webhook signature');
    }

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;
      
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
        break;
      
      case 'checkout.session.completed':
        await this.handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
        break;
      
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  // Handle successful payment
  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const quoteId = paymentIntent.metadata.quote_id;
    
    if (!quoteId) {
      console.error('No quote ID in payment intent metadata');
      return;
    }

    // Update payment record
    await this.env.DB.prepare(`
      UPDATE payments 
      SET status = 'succeeded',
          stripe_charge_id = ?,
          updated_at = datetime('now')
      WHERE stripe_payment_intent_id = ?
    `).bind(
      paymentIntent.latest_charge as string,
      paymentIntent.id
    ).run();

    // Update quote status
    await this.env.DB.prepare(`
      UPDATE quotes 
      SET status = 'accepted',
          accepted_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(quoteId).run();

    // Get quote and customer details
    const quote = await this.env.DB.prepare(`
      SELECT q.*, c.phone_number, c.total_spent
      FROM quotes q
      JOIN customers c ON q.customer_id = c.id
      WHERE q.id = ?
    `).bind(quoteId).first() as any;

    if (quote) {
      // Update customer spending
      await this.env.DB.prepare(`
        UPDATE customers 
        SET total_spent = total_spent + ?
        WHERE id = ?
      `).bind(quote.total_amount, quote.customer_id).run();

      // Track successful payment
      await this.tracker.trackPaymentFlow(
        quoteId,
        true,
        paymentIntent.amount / 100,
        paymentIntent.payment_method_types[0]
      );

      // Send confirmation via WhatsApp
      await this.sendPaymentConfirmation(quote.phone_number, quote);
    }
  }

  // Handle failed payment
  private async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const quoteId = paymentIntent.metadata.quote_id;
    
    if (!quoteId) return;

    // Update payment record
    await this.env.DB.prepare(`
      UPDATE payments 
      SET status = 'failed',
          failure_reason = ?,
          updated_at = datetime('now')
      WHERE stripe_payment_intent_id = ?
    `).bind(
      paymentIntent.last_payment_error?.message || 'Payment failed',
      paymentIntent.id
    ).run();

    // Track failed payment
    await this.tracker.trackPaymentFlow(
      quoteId,
      false,
      paymentIntent.amount / 100,
      paymentIntent.payment_method_types[0],
      paymentIntent.last_payment_error?.message
    );
  }

  // Handle checkout session completion
  private async handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<void> {
    const quoteId = session.metadata?.quote_id;
    
    if (!quoteId) return;

    console.log(`Checkout completed for quote: ${quoteId}`);
    
    // Additional checkout complete logic here
    await this.tracker.trackEvent('payment_completed', true, {
      quote_id: quoteId,
      session_id: session.id,
      amount: session.amount_total ? session.amount_total / 100 : 0
    });
  }

  // Handle subscription updates
  private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    const merchantId = subscription.metadata?.merchant_id;
    
    if (!merchantId) return;

    // Map Stripe price IDs to subscription tiers
    const priceToTier: Record<string, string> = {
      'price_starter': 'starter',
      'price_professional': 'professional',
      'price_enterprise': 'enterprise'
    };

    const tier = priceToTier[subscription.items.data[0]?.price.id] || 'starter';

    // Update merchant subscription
    await this.env.DB.prepare(`
      UPDATE merchants 
      SET stripe_subscription_id = ?,
          subscription_tier = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(subscription.id, tier, merchantId).run();

    // Update quote limits based on tier
    const limits: Record<string, number> = {
      'starter': 300,
      'professional': 1000,
      'enterprise': 5000
    };

    await this.env.DB.prepare(`
      UPDATE merchants 
      SET quotes_monthly_limit = ?
      WHERE id = ?
    `).bind(limits[tier], merchantId).run();
  }

  // Send payment confirmation via WhatsApp
  private async sendPaymentConfirmation(
    phoneNumber: string,
    quote: any
  ): Promise<void> {
    const message = `
✅ *Payment Confirmed!*

Thank you for your payment of $${quote.total_amount.toFixed(2)} for Quote #${quote.quote_number}.

Your service appointment can now be scheduled. Reply with your preferred date and time, or click below to book online.

Receipt: https://snapquote.app/receipt/${quote.id}
    `.trim();

    // This would integrate with WhatsApp service
    console.log(`Sending payment confirmation to ${phoneNumber}`);
  }

  // Get payment status
  async getPaymentStatus(paymentId: string): Promise<Payment | null> {
    const result = await this.env.DB.prepare(`
      SELECT * FROM payments WHERE id = ?
    `).bind(paymentId).first();

    return result as Payment | null;
  }

  // Calculate payment metrics
  async calculatePaymentMetrics(days: number = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const metrics = await this.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_payments,
        SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) as successful_payments,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_payments,
        SUM(CASE WHEN status = 'succeeded' THEN amount ELSE 0 END) as total_revenue,
        AVG(CASE WHEN status = 'succeeded' THEN amount END) as avg_payment_amount,
        AVG(processing_time_ms) as avg_processing_time
      FROM payments
      WHERE merchant_id = ? AND created_at >= ?
    `).bind(this.merchant.id, startDate.toISOString()).first();

    const successRate = metrics ? 
      ((metrics.successful_payments as number) / (metrics.total_payments as number) * 100) : 0;

    return {
      ...metrics,
      success_rate: successRate,
      target_success_rate: 95,
      meets_target: successRate >= 95
    };
  }

  // Process refund
  async processRefund(
    paymentId: string,
    amount?: number,
    reason?: string
  ): Promise<Stripe.Refund> {
    const payment = await this.getPaymentStatus(paymentId);
    
    if (!payment || payment.status !== 'succeeded') {
      throw new Error('Payment not eligible for refund');
    }

    const refund = await this.stripe.refunds.create({
      payment_intent: payment.stripe_payment_intent_id!,
      amount: amount ? Math.round(amount * 100) : undefined, // Partial refund if amount specified
      reason: 'requested_by_customer',
      metadata: {
        payment_id: paymentId,
        merchant_id: this.merchant.id,
        reason: reason || 'Customer request'
      }
    });

    // Update payment status
    await this.env.DB.prepare(`
      UPDATE payments 
      SET status = 'refunded',
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(paymentId).run();

    return refund;
  }
}