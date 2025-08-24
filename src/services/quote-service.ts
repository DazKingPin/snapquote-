// Quote Generation Service with Performance Monitoring

import type { 
  CloudflareBindings, 
  Quote, 
  QuoteItem,
  ImageAnalysis,
  Merchant,
  Customer,
  ServiceType
} from '../types';
import { createPerformanceTracker } from '../lib/monitoring/performance-tracker';

export class QuoteService {
  private env: CloudflareBindings;
  private merchant: Merchant;
  private tracker: ReturnType<typeof createPerformanceTracker>;

  constructor(env: CloudflareBindings, merchant: Merchant) {
    this.env = env;
    this.merchant = merchant;
    this.tracker = createPerformanceTracker(env.DB, merchant.id);
  }

  // Generate quote from AI analysis
  async generateQuote(
    analysis: ImageAnalysis,
    customer: Customer,
    customItems?: QuoteItem[]
  ): Promise<Quote> {
    const startTime = Date.now();

    try {
      // Check monthly quote limit
      if (this.merchant.quotes_used_this_month >= this.merchant.quotes_monthly_limit) {
        throw new Error('Monthly quote limit reached');
      }

      // Generate quote items from analysis or use custom items
      const items = customItems || await this.generateQuoteItems(analysis);
      
      // Calculate pricing
      const pricing = this.calculatePricing(items);
      
      // Generate unique quote number
      const quoteNumber = await this.generateQuoteNumber();
      
      // Set expiration (7 days from now)
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 7);

      // Create quote in database
      const quoteId = crypto.randomUUID();
      const generationTime = Date.now() - startTime;

      await this.env.DB.prepare(`
        INSERT INTO quotes (
          id, merchant_id, customer_id, analysis_id, quote_number,
          items, subtotal, tax_rate, tax_amount, discount_amount,
          total_amount, status, valid_until, generation_time_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        quoteId,
        this.merchant.id,
        customer.id,
        analysis.id,
        quoteNumber,
        JSON.stringify(items),
        pricing.subtotal,
        pricing.taxRate,
        pricing.taxAmount,
        pricing.discountAmount,
        pricing.totalAmount,
        'pending',
        validUntil.toISOString(),
        generationTime
      ).run();

      // Update merchant's quote count
      await this.env.DB.prepare(`
        UPDATE merchants 
        SET quotes_used_this_month = quotes_used_this_month + 1,
            updated_at = datetime('now')
        WHERE id = ?
      `).bind(this.merchant.id).run();

      // Update customer's quote count
      await this.env.DB.prepare(`
        UPDATE customers 
        SET total_quotes = total_quotes + 1,
            updated_at = datetime('now')
        WHERE id = ?
      `).bind(customer.id).run();

      // Track quote generation performance
      await this.tracker.trackQuoteGeneration(
        quoteId,
        generationTime,
        analysis.ai_confidence,
        items.length
      );

      // Track funnel progression
      await this.tracker.trackUserFunnel('quote_generated', {
        quote_id: quoteId,
        customer_id: customer.id,
        amount: pricing.totalAmount
      });

      const quote: Quote = {
        id: quoteId,
        merchant_id: this.merchant.id,
        customer_id: customer.id,
        analysis_id: analysis.id,
        quote_number: quoteNumber,
        items: items,
        subtotal: pricing.subtotal,
        tax_rate: pricing.taxRate,
        tax_amount: pricing.taxAmount,
        discount_amount: pricing.discountAmount,
        total_amount: pricing.totalAmount,
        status: 'pending',
        valid_until: validUntil.toISOString(),
        generation_time_ms: generationTime,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Check if generation time exceeds threshold
      if (generationTime > 15000) {
        await this.tracker.trackEvent('error_occurred', false, {
          type: 'slow_quote_generation',
          time_ms: generationTime,
          quote_id: quoteId
        });
      }

      return quote;

    } catch (error) {
      console.error('Quote generation error:', error);
      
      await this.tracker.trackEvent('quote_generated', false, {
        error: error instanceof Error ? error.message : 'Unknown error',
        analysis_id: analysis.id
      });
      
      throw error;
    }
  }

  // Generate quote items from AI analysis
  private async generateQuoteItems(analysis: ImageAnalysis): Promise<QuoteItem[]> {
    const items: QuoteItem[] = [];
    const serviceTypes = await this.getServiceTypes();

    // Map detected services to quote items
    for (const detectedService of analysis.detected_services) {
      const serviceType = serviceTypes.find(st => st.id === detectedService.service_type_id);
      
      if (serviceType) {
        const unitPrice = this.calculateUnitPrice(serviceType, detectedService.quantity);
        const totalPrice = unitPrice * detectedService.quantity;

        items.push({
          description: serviceType.service_name,
          quantity: detectedService.quantity,
          unit: detectedService.unit,
          unit_price: unitPrice,
          total_price: totalPrice,
          notes: serviceType.description
        });
      }
    }

    // Add any additional items based on complexity
    if (analysis.analysis_result.estimated_complexity === 'high') {
      items.push({
        description: 'Complex Job Surcharge',
        quantity: 1,
        unit: 'fee',
        unit_price: 50,
        total_price: 50,
        notes: 'Additional charge for complex work requirements'
      });
    }

    // Ensure at least one item
    if (items.length === 0) {
      items.push({
        description: 'Service Assessment',
        quantity: 1,
        unit: 'assessment',
        unit_price: 100,
        total_price: 100,
        notes: 'Initial service assessment fee'
      });
    }

    return items;
  }

  // Calculate unit price based on service type and quantity
  private calculateUnitPrice(serviceType: ServiceType, quantity: number): number {
    let price = serviceType.base_price;

    // Apply quantity-based pricing if configured
    if (serviceType.price_per_unit) {
      price = serviceType.price_per_unit;
      
      // Apply volume discounts
      if (quantity > 100) {
        price *= 0.9; // 10% discount for large quantities
      } else if (quantity > 50) {
        price *= 0.95; // 5% discount for medium quantities
      }
    }

    return Math.round(price * 100) / 100; // Round to 2 decimal places
  }

  // Calculate pricing totals
  private calculatePricing(items: QuoteItem[]): {
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    discountAmount: number;
    totalAmount: number;
  } {
    const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
    const taxRate = 0.08; // 8% tax rate (configurable per merchant)
    const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
    
    // Calculate discount based on subtotal
    let discountAmount = 0;
    if (subtotal > 1000) {
      discountAmount = Math.round(subtotal * 0.05 * 100) / 100; // 5% discount over $1000
    } else if (subtotal > 500) {
      discountAmount = Math.round(subtotal * 0.02 * 100) / 100; // 2% discount over $500
    }

    const totalAmount = Math.round((subtotal + taxAmount - discountAmount) * 100) / 100;

    return {
      subtotal,
      taxRate,
      taxAmount,
      discountAmount,
      totalAmount
    };
  }

  // Generate unique quote number
  private async generateQuoteNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    // Get count of quotes this month
    const result = await this.env.DB.prepare(`
      SELECT COUNT(*) as count FROM quotes 
      WHERE merchant_id = ? 
      AND strftime('%Y-%m', created_at) = ?
    `).bind(this.merchant.id, `${year}-${month}`).first() as any;

    const count = (result?.count || 0) + 1;
    const merchantPrefix = this.merchant.business_name.substring(0, 3).toUpperCase();
    
    return `${merchantPrefix}-${year}${month}-${String(count).padStart(4, '0')}`;
  }

  // Get service types for merchant
  private async getServiceTypes(): Promise<ServiceType[]> {
    const result = await this.env.DB.prepare(`
      SELECT * FROM service_types 
      WHERE merchant_id = ? AND is_active = 1
      ORDER BY service_name
    `).bind(this.merchant.id).all();

    return result.results as ServiceType[];
  }

  // Update quote status
  async updateQuoteStatus(
    quoteId: string,
    status: Quote['status'],
    metadata?: Record<string, any>
  ): Promise<void> {
    const updateFields: string[] = [`status = ?`];
    const values: any[] = [status];

    // Add timestamp fields based on status
    switch (status) {
      case 'sent':
        updateFields.push('sent_at = datetime("now")');
        break;
      case 'viewed':
        updateFields.push('viewed_at = datetime("now")');
        break;
      case 'accepted':
        updateFields.push('accepted_at = datetime("now")');
        break;
    }

    updateFields.push('updated_at = datetime("now")');
    values.push(quoteId);

    await this.env.DB.prepare(`
      UPDATE quotes 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `).bind(...values).run();

    // Track status change
    await this.tracker.trackEvent('quote_generated', true, {
      quote_id: quoteId,
      new_status: status,
      ...metadata
    });
  }

  // Get quote by ID
  async getQuote(quoteId: string): Promise<Quote | null> {
    const result = await this.env.DB.prepare(`
      SELECT * FROM quotes WHERE id = ?
    `).bind(quoteId).first();

    if (!result) return null;

    return {
      ...result,
      items: JSON.parse(result.items as string)
    } as Quote;
  }

  // Get quotes for customer
  async getCustomerQuotes(customerId: string, limit: number = 10): Promise<Quote[]> {
    const result = await this.env.DB.prepare(`
      SELECT * FROM quotes 
      WHERE merchant_id = ? AND customer_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(this.merchant.id, customerId, limit).all();

    return result.results.map(q => ({
      ...q,
      items: JSON.parse(q.items as string)
    })) as Quote[];
  }

  // Calculate conversion metrics
  async calculateConversionMetrics(days: number = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const metrics = await this.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_quotes,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as quotes_sent,
        SUM(CASE WHEN status = 'viewed' THEN 1 ELSE 0 END) as quotes_viewed,
        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as quotes_accepted,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as quotes_rejected,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as quotes_expired,
        AVG(total_amount) as avg_quote_value,
        AVG(generation_time_ms) as avg_generation_time,
        MAX(generation_time_ms) as max_generation_time,
        MIN(generation_time_ms) as min_generation_time
      FROM quotes
      WHERE merchant_id = ? AND created_at >= ?
    `).bind(this.merchant.id, startDate.toISOString()).first();

    return {
      ...metrics,
      conversion_rate: metrics ? ((metrics.quotes_accepted as number) / (metrics.total_quotes as number) * 100) : 0,
      view_rate: metrics ? ((metrics.quotes_viewed as number) / (metrics.quotes_sent as number) * 100) : 0
    };
  }

  // Regenerate quote with modifications
  async regenerateQuote(
    originalQuoteId: string,
    modifications: {
      items?: QuoteItem[];
      discountAmount?: number;
      notes?: string;
    }
  ): Promise<Quote> {
    const original = await this.getQuote(originalQuoteId);
    if (!original) {
      throw new Error('Original quote not found');
    }

    const analysis = await this.env.DB.prepare(`
      SELECT * FROM image_analyses WHERE id = ?
    `).bind(original.analysis_id).first() as ImageAnalysis;

    const customer = await this.env.DB.prepare(`
      SELECT * FROM customers WHERE id = ?
    `).bind(original.customer_id).first() as Customer;

    // Generate new quote with modifications
    const newItems = modifications.items || original.items;
    const newQuote = await this.generateQuote(analysis, customer, newItems);

    // Apply custom discount if provided
    if (modifications.discountAmount !== undefined) {
      await this.env.DB.prepare(`
        UPDATE quotes 
        SET discount_amount = ?, 
            total_amount = subtotal + tax_amount - ?,
            notes = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).bind(
        modifications.discountAmount,
        modifications.discountAmount,
        modifications.notes || null,
        newQuote.id
      ).run();

      newQuote.discount_amount = modifications.discountAmount;
      newQuote.total_amount = newQuote.subtotal + newQuote.tax_amount - modifications.discountAmount;
      newQuote.notes = modifications.notes;
    }

    return newQuote;
  }
}