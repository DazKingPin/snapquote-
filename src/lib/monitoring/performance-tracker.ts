// Performance Monitoring and Event Tracking Service

import type { CloudflareBindings, SystemEvent, PerformanceMetric, EventType } from '../../types';

export class PerformanceTracker {
  private db: D1Database;
  private startTime: number;
  private merchantId?: string;

  constructor(db: D1Database, merchantId?: string) {
    this.db = db;
    this.merchantId = merchantId;
    this.startTime = Date.now();
  }

  // Track system events with timing
  async trackEvent(
    eventType: EventType,
    success: boolean = true,
    metadata: Record<string, any> = {},
    customerPhone?: string,
    errorMessage?: string
  ): Promise<void> {
    const processingTime = Date.now() - this.startTime;
    
    try {
      await this.db.prepare(`
        INSERT INTO system_events (
          event_type, merchant_id, customer_phone, 
          processing_time_ms, success, error_message, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        eventType,
        this.merchantId || null,
        customerPhone || null,
        processingTime,
        success ? 1 : 0,
        errorMessage || null,
        JSON.stringify(metadata)
      ).run();

      // Check for performance threshold violations
      await this.checkPerformanceThresholds(eventType, processingTime);
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }

  // Track performance metrics
  async trackMetric(
    metricName: string,
    metricValue: number,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      await this.db.prepare(`
        INSERT INTO performance_metrics (
          merchant_id, metric_name, metric_value, metadata
        ) VALUES (?, ?, ?, ?)
      `).bind(
        this.merchantId || null,
        metricName,
        metricValue,
        JSON.stringify(metadata)
      ).run();
    } catch (error) {
      console.error('Failed to track metric:', error);
    }
  }

  // Track quote generation performance
  async trackQuoteGeneration(
    quoteId: string,
    processingTime: number,
    aiConfidence: number,
    itemCount: number
  ): Promise<void> {
    await this.trackEvent('quote_generated', true, {
      quote_id: quoteId,
      ai_confidence: aiConfidence,
      item_count: itemCount
    });

    await this.trackMetric('quote_generation_time', processingTime, {
      quote_id: quoteId
    });

    await this.trackMetric('ai_confidence_score', aiConfidence, {
      quote_id: quoteId
    });
  }

  // Track payment flow
  async trackPaymentFlow(
    quoteId: string,
    success: boolean,
    amount: number,
    paymentMethod?: string,
    failureReason?: string
  ): Promise<void> {
    const eventType = success ? 'payment_completed' : 'payment_initiated';
    
    await this.trackEvent(eventType, success, {
      quote_id: quoteId,
      amount: amount,
      payment_method: paymentMethod,
      failure_reason: failureReason
    });

    if (success) {
      await this.trackMetric('payment_success_rate', 1, { quote_id: quoteId });
      await this.trackMetric('revenue', amount, { quote_id: quoteId });
    } else {
      await this.trackMetric('payment_success_rate', 0, { quote_id: quoteId });
    }
  }

  // Track AI analysis performance
  async trackAIAnalysis(
    analysisId: string,
    processingTime: number,
    confidence: number,
    modelUsed: string,
    success: boolean = true
  ): Promise<void> {
    await this.trackEvent('ai_analysis_completed', success, {
      analysis_id: analysisId,
      model: modelUsed,
      confidence: confidence
    });

    await this.trackMetric('ai_processing_time', processingTime, {
      analysis_id: analysisId,
      model: modelUsed
    });
  }

  // Track user funnel stages
  async trackUserFunnel(
    stage: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    await this.trackMetric('funnel_stage', 1, {
      stage: stage,
      ...metadata
    });
  }

  // Check performance thresholds and trigger alerts
  private async checkPerformanceThresholds(
    eventType: EventType,
    processingTime: number
  ): Promise<void> {
    const thresholds: Record<string, number> = {
      'whatsapp_message_received': 3000,
      'ai_analysis_completed': 12000,
      'quote_generated': 15000,
      'payment_initiated': 5000
    };

    const threshold = thresholds[eventType];
    if (threshold && processingTime > threshold) {
      await this.triggerAlert(
        'response_time',
        `${eventType} exceeded threshold: ${processingTime}ms > ${threshold}ms`
      );
    }
  }

  // Trigger alerts for threshold violations
  private async triggerAlert(alertType: string, message: string): Promise<void> {
    // Check if alerts are configured for this merchant
    if (!this.merchantId) return;

    const alertConfig = await this.db.prepare(`
      SELECT * FROM alert_configurations 
      WHERE merchant_id = ? AND alert_type = ? AND is_active = 1
    `).bind(this.merchantId, alertType).first();

    if (alertConfig) {
      // Log the alert
      console.warn(`ALERT [${alertType}]: ${message}`);
      
      // In production, this would send notifications via configured channels
      await this.trackEvent('error_occurred', false, {
        alert_type: alertType,
        message: message
      });
    }
  }

  // Get current processing time
  getProcessingTime(): number {
    return Date.now() - this.startTime;
  }

  // Calculate conversion funnel metrics
  async calculateFunnelMetrics(merchantId: string, days: number = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const metrics = await this.db.prepare(`
      SELECT 
        COUNT(DISTINCT CASE WHEN event_type = 'whatsapp_message_received' THEN customer_phone END) as messages_received,
        COUNT(DISTINCT CASE WHEN event_type = 'image_downloaded' THEN customer_phone END) as images_downloaded,
        COUNT(DISTINCT CASE WHEN event_type = 'ai_analysis_completed' THEN customer_phone END) as analyses_completed,
        COUNT(DISTINCT CASE WHEN event_type = 'quote_generated' THEN customer_phone END) as quotes_generated,
        COUNT(DISTINCT CASE WHEN event_type = 'payment_initiated' THEN customer_phone END) as payments_initiated,
        COUNT(DISTINCT CASE WHEN event_type = 'payment_completed' THEN customer_phone END) as payments_completed,
        AVG(CASE WHEN event_type = 'quote_generated' THEN processing_time_ms END) as avg_quote_time,
        AVG(CASE WHEN event_type = 'ai_analysis_completed' THEN processing_time_ms END) as avg_analysis_time
      FROM system_events
      WHERE merchant_id = ? AND created_at >= ?
    `).bind(merchantId, startDate.toISOString()).first();

    return metrics;
  }

  // Get performance summary
  async getPerformanceSummary(merchantId: string): Promise<any> {
    const [events, metrics] = await Promise.all([
      this.db.prepare(`
        SELECT 
          event_type,
          COUNT(*) as count,
          AVG(processing_time_ms) as avg_time,
          MAX(processing_time_ms) as max_time,
          MIN(processing_time_ms) as min_time,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate
        FROM system_events
        WHERE merchant_id = ? AND created_at >= datetime('now', '-24 hours')
        GROUP BY event_type
      `).bind(merchantId).all(),
      
      this.db.prepare(`
        SELECT 
          metric_name,
          AVG(metric_value) as avg_value,
          MAX(metric_value) as max_value,
          MIN(metric_value) as min_value,
          COUNT(*) as sample_count
        FROM performance_metrics
        WHERE merchant_id = ? AND measurement_timestamp >= datetime('now', '-24 hours')
        GROUP BY metric_name
      `).bind(merchantId).all()
    ]);

    return {
      events: events.results,
      metrics: metrics.results,
      timestamp: new Date().toISOString()
    };
  }
}

// Helper function to create tracker instance
export function createPerformanceTracker(db: D1Database, merchantId?: string): PerformanceTracker {
  return new PerformanceTracker(db, merchantId);
}