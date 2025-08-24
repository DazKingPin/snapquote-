-- SnapQuote Database Schema with Performance Monitoring
-- Created: 2025-08-24

-- Merchants table
CREATE TABLE IF NOT EXISTS merchants (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    business_name TEXT NOT NULL,
    phone_number TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    subscription_tier TEXT DEFAULT 'starter' CHECK(subscription_tier IN ('starter', 'professional', 'enterprise')),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    ai_confidence_threshold REAL DEFAULT 0.75,
    quotes_monthly_limit INTEGER DEFAULT 300,
    quotes_used_this_month INTEGER DEFAULT 0,
    settings JSON DEFAULT '{}',
    webhook_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    merchant_id TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    name TEXT,
    email TEXT,
    metadata JSON DEFAULT '{}',
    total_quotes INTEGER DEFAULT 0,
    total_spent REAL DEFAULT 0,
    last_interaction DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
    UNIQUE(merchant_id, phone_number)
);

-- Service types configuration
CREATE TABLE IF NOT EXISTS service_types (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    merchant_id TEXT NOT NULL,
    service_name TEXT NOT NULL,
    base_price REAL NOT NULL,
    price_per_unit REAL,
    unit_type TEXT, -- 'sqft', 'hour', 'item', etc
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

-- Image analysis records
CREATE TABLE IF NOT EXISTS image_analyses (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    merchant_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    image_url TEXT NOT NULL,
    whatsapp_media_id TEXT,
    analysis_result JSON NOT NULL,
    ai_confidence REAL NOT NULL,
    ai_model TEXT DEFAULT 'gpt-4o-vision',
    processing_time_ms INTEGER,
    detected_services JSON,
    measurements JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Quotes table
CREATE TABLE IF NOT EXISTS quotes (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    merchant_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    analysis_id TEXT,
    quote_number TEXT UNIQUE NOT NULL,
    items JSON NOT NULL,
    subtotal REAL NOT NULL,
    tax_rate REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    total_amount REAL NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'viewed', 'accepted', 'rejected', 'expired')),
    valid_until DATETIME,
    payment_link TEXT,
    stripe_payment_intent_id TEXT,
    generation_time_ms INTEGER,
    sent_at DATETIME,
    viewed_at DATETIME,
    accepted_at DATETIME,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (analysis_id) REFERENCES image_analyses(id) ON DELETE SET NULL
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    quote_id TEXT NOT NULL,
    merchant_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded')),
    stripe_payment_intent_id TEXT UNIQUE,
    stripe_charge_id TEXT,
    payment_method TEXT,
    processing_time_ms INTEGER,
    failure_reason TEXT,
    metadata JSON DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    quote_id TEXT NOT NULL,
    merchant_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
    notes TEXT,
    reminder_sent BOOLEAN DEFAULT false,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Performance metrics table for monitoring
CREATE TABLE IF NOT EXISTS performance_metrics (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    merchant_id TEXT,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    measurement_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata JSON DEFAULT '{}',
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

-- System events table for tracking
CREATE TABLE IF NOT EXISTS system_events (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    event_type TEXT NOT NULL,
    merchant_id TEXT,
    customer_phone TEXT,
    processing_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    metadata JSON DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

-- Alerts configuration table
CREATE TABLE IF NOT EXISTS alert_configurations (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    merchant_id TEXT,
    alert_type TEXT NOT NULL, -- 'response_time', 'ai_confidence', 'payment_failure', 'system_error'
    threshold_value REAL NOT NULL,
    notification_channel TEXT DEFAULT 'email', -- 'email', 'whatsapp', 'webhook'
    is_active BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

-- Webhook logs for debugging
CREATE TABLE IF NOT EXISTS webhook_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    merchant_id TEXT,
    webhook_type TEXT NOT NULL, -- 'whatsapp', 'stripe', 'custom'
    url TEXT NOT NULL,
    payload JSON NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    processing_time_ms INTEGER,
    retry_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_merchants_phone ON merchants(phone_number);
CREATE INDEX IF NOT EXISTS idx_merchants_email ON merchants(email);
CREATE INDEX IF NOT EXISTS idx_customers_merchant_phone ON customers(merchant_id, phone_number);
CREATE INDEX IF NOT EXISTS idx_quotes_merchant_status ON quotes(merchant_id, status);
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_created ON quotes(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_merchant ON payments(merchant_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_merchant_date ON appointments(merchant_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_system_events_type ON system_events(event_type);
CREATE INDEX IF NOT EXISTS idx_system_events_merchant ON system_events(merchant_id);
CREATE INDEX IF NOT EXISTS idx_system_events_created ON system_events(created_at);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_merchant ON performance_metrics(merchant_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON performance_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_merchant ON webhook_logs(merchant_id);