// SnapQuote Type Definitions

export interface CloudflareBindings {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  OPENAI_API_KEY: string;
  WHATSAPP_ACCESS_TOKEN: string;
  WHATSAPP_VERIFY_TOKEN: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_PHONE_NUMBER: string;
}

export interface Merchant {
  id: string;
  business_name: string;
  phone_number: string;
  email: string;
  subscription_tier: 'starter' | 'professional' | 'enterprise';
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  ai_confidence_threshold: number;
  quotes_monthly_limit: number;
  quotes_used_this_month: number;
  settings: Record<string, any>;
  webhook_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  merchant_id: string;
  phone_number: string;
  name?: string;
  email?: string;
  metadata: Record<string, any>;
  total_quotes: number;
  total_spent: number;
  last_interaction?: string;
  created_at: string;
  updated_at: string;
}

export interface ServiceType {
  id: string;
  merchant_id: string;
  service_name: string;
  base_price: number;
  price_per_unit?: number;
  unit_type?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface ImageAnalysis {
  id: string;
  merchant_id: string;
  customer_id: string;
  image_url: string;
  whatsapp_media_id?: string;
  analysis_result: AnalysisResult;
  ai_confidence: number;
  ai_model: string;
  processing_time_ms: number;
  detected_services: DetectedService[];
  measurements: Measurements;
  created_at: string;
}

export interface AnalysisResult {
  description: string;
  detected_items: Array<{
    item: string;
    confidence: number;
    quantity?: number;
    dimensions?: {
      width?: number;
      height?: number;
      area?: number;
      unit: string;
    };
  }>;
  suggested_services: string[];
  estimated_complexity: 'low' | 'medium' | 'high';
  notes?: string;
}

export interface DetectedService {
  service_type_id: string;
  service_name: string;
  quantity: number;
  unit: string;
  confidence: number;
}

export interface Measurements {
  area?: number;
  linear_feet?: number;
  count?: number;
  hours_estimated?: number;
  unit: string;
}

export interface Quote {
  id: string;
  merchant_id: string;
  customer_id: string;
  analysis_id?: string;
  quote_number: string;
  items: QuoteItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  status: 'pending' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';
  valid_until?: string;
  payment_link?: string;
  stripe_payment_intent_id?: string;
  generation_time_ms: number;
  sent_at?: string;
  viewed_at?: string;
  accepted_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface QuoteItem {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  notes?: string;
}

export interface Payment {
  id: string;
  quote_id: string;
  merchant_id: string;
  customer_id: string;
  amount: number;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'refunded';
  stripe_payment_intent_id?: string;
  stripe_charge_id?: string;
  payment_method?: string;
  processing_time_ms?: number;
  failure_reason?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  quote_id: string;
  merchant_id: string;
  customer_id: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
  reminder_sent: boolean;
  created_at: string;
  updated_at: string;
}

// Performance Monitoring Types
export interface PerformanceMetric {
  id: string;
  merchant_id?: string;
  metric_name: string;
  metric_value: number;
  measurement_timestamp: string;
  metadata: Record<string, any>;
}

export interface SystemEvent {
  id: string;
  event_type: EventType;
  merchant_id?: string;
  customer_phone?: string;
  processing_time_ms?: number;
  success: boolean;
  error_message?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export type EventType = 
  | 'whatsapp_message_received'
  | 'image_downloaded'
  | 'ai_analysis_completed'
  | 'quote_generated'
  | 'payment_initiated'
  | 'payment_completed'
  | 'appointment_booked'
  | 'webhook_sent'
  | 'error_occurred';

export interface AlertConfiguration {
  id: string;
  merchant_id?: string;
  alert_type: 'response_time' | 'ai_confidence' | 'payment_failure' | 'system_error';
  threshold_value: number;
  notification_channel: 'email' | 'whatsapp' | 'webhook';
  is_active: boolean;
  created_at: string;
}

export interface WebhookLog {
  id: string;
  merchant_id?: string;
  webhook_type: 'whatsapp' | 'stripe' | 'custom';
  url: string;
  payload: Record<string, any>;
  response_status?: number;
  response_body?: string;
  processing_time_ms?: number;
  retry_count: number;
  created_at: string;
}

// WhatsApp Types
export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video';
  text?: {
    body: string;
  };
  image?: {
    id: string;
    mime_type: string;
    sha256: string;
  };
}

export interface WhatsAppWebhook {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        messages?: WhatsAppMessage[];
      };
      field: string;
    }>;
  }>;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    processing_time_ms: number;
    timestamp: string;
    request_id: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}