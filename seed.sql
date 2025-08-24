-- SnapQuote Test Seed Data

-- Insert test merchant
INSERT OR IGNORE INTO merchants (
  id, business_name, phone_number, email, 
  subscription_tier, ai_confidence_threshold, 
  quotes_monthly_limit, settings
) VALUES (
  'merchant-001',
  'Pro Clean Services',
  '+14155551234',
  'admin@proclean.com',
  'professional',
  0.75,
  1000,
  '{"business_type": "cleaning", "auto_quote": true}'
);

-- Insert service types for the merchant
INSERT OR IGNORE INTO service_types (id, merchant_id, service_name, base_price, price_per_unit, unit_type, description) VALUES
  ('service-001', 'merchant-001', 'Window Cleaning', 25.00, 2.50, 'sqft', 'Professional window cleaning service'),
  ('service-002', 'merchant-001', 'Carpet Cleaning', 50.00, 0.75, 'sqft', 'Deep carpet cleaning and stain removal'),
  ('service-003', 'merchant-001', 'Pressure Washing', 100.00, 1.25, 'sqft', 'High-pressure exterior cleaning'),
  ('service-004', 'merchant-001', 'Gutter Cleaning', 150.00, 3.00, 'linear_feet', 'Gutter cleaning and maintenance'),
  ('service-005', 'merchant-001', 'House Cleaning', 80.00, 30.00, 'hour', 'Complete house cleaning service');

-- Insert test customers
INSERT OR IGNORE INTO customers (id, merchant_id, phone_number, name, email) VALUES
  ('customer-001', 'merchant-001', '+14155552345', 'John Smith', 'john@example.com'),
  ('customer-002', 'merchant-001', '+14155553456', 'Sarah Johnson', 'sarah@example.com'),
  ('customer-003', 'merchant-001', '+14155554567', 'Mike Davis', 'mike@example.com');

-- Insert alert configurations
INSERT OR IGNORE INTO alert_configurations (merchant_id, alert_type, threshold_value, notification_channel) VALUES
  ('merchant-001', 'response_time', 15000, 'email'),
  ('merchant-001', 'ai_confidence', 0.70, 'email'),
  ('merchant-001', 'payment_failure', 0.05, 'whatsapp');

-- Insert sample performance metrics
INSERT OR IGNORE INTO performance_metrics (merchant_id, metric_name, metric_value, metadata) VALUES
  ('merchant-001', 'quote_generation_time', 8500, '{"quote_id": "test-001"}'),
  ('merchant-001', 'ai_processing_time', 5200, '{"model": "gpt-4o-vision"}'),
  ('merchant-001', 'payment_success_rate', 0.965, '{"period": "last_30_days"}'),
  ('merchant-001', 'conversion_rate', 0.42, '{"funnel_stage": "quote_to_payment"}');

-- Insert sample system events
INSERT OR IGNORE INTO system_events (event_type, merchant_id, processing_time_ms, success, metadata) VALUES
  ('whatsapp_message_received', 'merchant-001', 1200, 1, '{"message_type": "image"}'),
  ('ai_analysis_completed', 'merchant-001', 8900, 1, '{"confidence": 0.89}'),
  ('quote_generated', 'merchant-001', 12300, 1, '{"amount": 450.00}'),
  ('payment_initiated', 'merchant-001', 2100, 1, '{"method": "stripe"}'),
  ('payment_completed', 'merchant-001', 4500, 1, '{"amount": 450.00}');