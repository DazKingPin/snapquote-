// SnapQuote Main Application with Performance Monitoring

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { CloudflareBindings, WhatsAppWebhook, ApiResponse } from './types';
import { WhatsAppService } from './services/whatsapp-service';
import { AIAnalysisService } from './services/ai-analysis-service';
import { QuoteService } from './services/quote-service';
import { PaymentService } from './services/payment-service';
import { createPerformanceTracker } from './lib/monitoring/performance-tracker';

const app = new Hono<{ Bindings: CloudflareBindings }>();

// Enable CORS for API routes
app.use('/api/*', cors({
  origin: ['https://snapquote.app', 'http://localhost:3000'],
  credentials: true
}));

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }));

// Health check endpoint
app.get('/health', async (c) => {
  const tracker = createPerformanceTracker(c.env.DB);
  
  try {
    // Check database connection
    await c.env.DB.prepare('SELECT 1').first();
    
    // Get system metrics
    const metrics = await tracker.getPerformanceSummary('system');
    
    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      metrics: metrics,
      version: '1.0.0'
    });
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 503);
  }
});

// WhatsApp webhook verification
app.get('/api/webhook/whatsapp', (c) => {
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');

  const whatsappService = new WhatsAppService(c.env);
  const result = whatsappService.verifyWebhook(mode!, token!, challenge!);

  if (result) {
    return c.text(result);
  }
  
  return c.text('Forbidden', 403);
});

// WhatsApp webhook handler
app.post('/api/webhook/whatsapp', async (c) => {
  const tracker = createPerformanceTracker(c.env.DB);
  const startTime = Date.now();

  try {
    const webhook = await c.req.json<WhatsAppWebhook>();
    const whatsappService = new WhatsAppService(c.env);
    
    await whatsappService.processWebhook(webhook);
    
    const processingTime = Date.now() - startTime;
    await tracker.trackMetric('webhook_processing_time', processingTime, {
      type: 'whatsapp'
    });

    return c.json({ success: true });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    
    await tracker.trackEvent('error_occurred', false, {
      type: 'webhook_processing',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});

// Stripe webhook handler
app.post('/api/webhook/stripe', async (c) => {
  const signature = c.req.header('stripe-signature');
  
  if (!signature) {
    return c.json({ error: 'Missing signature' }, 400);
  }

  try {
    const rawBody = await c.req.text();
    
    // Get a merchant for the payment service (in production, this would be determined from the webhook)
    const merchant = await c.env.DB.prepare(`
      SELECT * FROM merchants LIMIT 1
    `).first();

    if (!merchant) {
      return c.json({ error: 'No merchant found' }, 400);
    }

    const paymentService = new PaymentService(c.env, merchant as any);
    await paymentService.processWebhook(signature, rawBody);
    
    return c.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return c.json({ error: 'Webhook processing failed' }, 400);
  }
});

// API: Analyze image
const analyzeImageSchema = z.object({
  merchant_id: z.string(),
  customer_id: z.string(),
  image_url: z.string().url(),
  media_id: z.string().optional()
});

app.post('/api/analyze', 
  zValidator('json', analyzeImageSchema),
  async (c) => {
    const data = c.req.valid('json');
    const tracker = createPerformanceTracker(c.env.DB, data.merchant_id);

    try {
      // Get merchant
      const merchant = await c.env.DB.prepare(`
        SELECT * FROM merchants WHERE id = ?
      `).bind(data.merchant_id).first();

      if (!merchant) {
        return c.json<ApiResponse>({
          success: false,
          error: 'Merchant not found'
        }, 404);
      }

      // Perform AI analysis
      const aiService = new AIAnalysisService(c.env, merchant as any);
      const analysis = await aiService.analyzeImage(
        data.image_url,
        data.customer_id,
        data.media_id
      );

      if (!analysis) {
        return c.json<ApiResponse>({
          success: false,
          error: 'Analysis confidence below threshold'
        }, 422);
      }

      return c.json<ApiResponse>({
        success: true,
        data: analysis,
        metadata: {
          processing_time_ms: analysis.processing_time_ms,
          timestamp: new Date().toISOString(),
          request_id: crypto.randomUUID()
        }
      });

    } catch (error) {
      await tracker.trackEvent('error_occurred', false, {
        type: 'image_analysis',
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return c.json<ApiResponse>({
        success: false,
        error: 'Analysis failed'
      }, 500);
    }
  }
);

// API: Generate quote
const generateQuoteSchema = z.object({
  merchant_id: z.string(),
  customer_id: z.string(),
  analysis_id: z.string()
});

app.post('/api/quotes/generate',
  zValidator('json', generateQuoteSchema),
  async (c) => {
    const data = c.req.valid('json');
    const tracker = createPerformanceTracker(c.env.DB, data.merchant_id);

    try {
      // Get merchant, customer, and analysis
      const [merchant, customer, analysis] = await Promise.all([
        c.env.DB.prepare(`SELECT * FROM merchants WHERE id = ?`).bind(data.merchant_id).first(),
        c.env.DB.prepare(`SELECT * FROM customers WHERE id = ?`).bind(data.customer_id).first(),
        c.env.DB.prepare(`SELECT * FROM image_analyses WHERE id = ?`).bind(data.analysis_id).first()
      ]);

      if (!merchant || !customer || !analysis) {
        return c.json<ApiResponse>({
          success: false,
          error: 'Required data not found'
        }, 404);
      }

      // Generate quote
      const quoteService = new QuoteService(c.env, merchant as any);
      const quote = await quoteService.generateQuote(
        {
          ...analysis,
          analysis_result: JSON.parse(analysis.analysis_result as string),
          detected_services: JSON.parse(analysis.detected_services as string),
          measurements: JSON.parse(analysis.measurements as string)
        } as any,
        customer as any
      );

      // Generate payment link
      const paymentService = new PaymentService(c.env, merchant as any);
      const { paymentLink } = await paymentService.createPaymentLink(
        quote,
        customer as any
      );

      return c.json<ApiResponse>({
        success: true,
        data: {
          quote,
          payment_link: paymentLink
        },
        metadata: {
          processing_time_ms: quote.generation_time_ms,
          timestamp: new Date().toISOString(),
          request_id: crypto.randomUUID()
        }
      });

    } catch (error) {
      await tracker.trackEvent('error_occurred', false, {
        type: 'quote_generation',
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return c.json<ApiResponse>({
        success: false,
        error: 'Quote generation failed'
      }, 500);
    }
  }
);

// API: Get performance metrics
app.get('/api/metrics/:merchant_id', async (c) => {
  const merchantId = c.req.param('merchant_id');
  const days = parseInt(c.req.query('days') || '30');
  
  const tracker = createPerformanceTracker(c.env.DB, merchantId);

  try {
    const [performance, funnel] = await Promise.all([
      tracker.getPerformanceSummary(merchantId),
      tracker.calculateFunnelMetrics(merchantId, days)
    ]);

    return c.json<ApiResponse>({
      success: true,
      data: {
        performance,
        funnel,
        period_days: days
      },
      metadata: {
        processing_time_ms: 0,
        timestamp: new Date().toISOString(),
        request_id: crypto.randomUUID()
      }
    });
  } catch (error) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to retrieve metrics'
    }, 500);
  }
});

// Merchant Analytics Dashboard
app.get('/dashboard', (c) => {
  return c.html(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SnapQuote Analytics Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50">
    <div class="min-h-screen">
        <!-- Header -->
        <header class="bg-white shadow-sm border-b">
            <div class="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
                <div class="flex items-center justify-between">
                    <h1 class="text-2xl font-bold text-gray-900">
                        <i class="fas fa-chart-line mr-2 text-blue-600"></i>
                        SnapQuote Analytics
                    </h1>
                    <div class="flex items-center space-x-4">
                        <span class="text-sm text-gray-500">Real-time Metrics</span>
                        <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    </div>
                </div>
            </div>
        </header>

        <!-- Performance Metrics -->
        <div class="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <!-- Response Time Card -->
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center justify-between mb-4">
                        <i class="fas fa-clock text-blue-500 text-2xl"></i>
                        <span class="text-xs text-gray-500">Target: <15s</span>
                    </div>
                    <h3 class="text-sm font-medium text-gray-500">Avg Response Time</h3>
                    <p class="text-2xl font-bold text-gray-900 mt-1">
                        <span id="avgResponseTime">12.3s</span>
                    </p>
                    <div class="mt-2">
                        <div class="w-full bg-gray-200 rounded-full h-1.5">
                            <div class="bg-green-500 h-1.5 rounded-full" style="width: 82%"></div>
                        </div>
                    </div>
                </div>

                <!-- AI Confidence Card -->
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center justify-between mb-4">
                        <i class="fas fa-brain text-purple-500 text-2xl"></i>
                        <span class="text-xs text-gray-500">Target: >75%</span>
                    </div>
                    <h3 class="text-sm font-medium text-gray-500">AI Confidence</h3>
                    <p class="text-2xl font-bold text-gray-900 mt-1">
                        <span id="aiConfidence">87.5%</span>
                    </p>
                    <div class="mt-2">
                        <div class="w-full bg-gray-200 rounded-full h-1.5">
                            <div class="bg-purple-500 h-1.5 rounded-full" style="width: 87.5%"></div>
                        </div>
                    </div>
                </div>

                <!-- Payment Success Card -->
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center justify-between mb-4">
                        <i class="fas fa-credit-card text-green-500 text-2xl"></i>
                        <span class="text-xs text-gray-500">Target: >95%</span>
                    </div>
                    <h3 class="text-sm font-medium text-gray-500">Payment Success</h3>
                    <p class="text-2xl font-bold text-gray-900 mt-1">
                        <span id="paymentSuccess">96.2%</span>
                    </p>
                    <div class="mt-2">
                        <div class="w-full bg-gray-200 rounded-full h-1.5">
                            <div class="bg-green-500 h-1.5 rounded-full" style="width: 96.2%"></div>
                        </div>
                    </div>
                </div>

                <!-- Revenue Card -->
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center justify-between mb-4">
                        <i class="fas fa-dollar-sign text-yellow-500 text-2xl"></i>
                        <span class="text-xs text-green-500">+12.5%</span>
                    </div>
                    <h3 class="text-sm font-medium text-gray-500">Monthly Revenue</h3>
                    <p class="text-2xl font-bold text-gray-900 mt-1">
                        <span id="monthlyRevenue">$24,567</span>
                    </p>
                    <div class="text-xs text-gray-500 mt-2">
                        164 quotes generated
                    </div>
                </div>
            </div>

            <!-- Conversion Funnel -->
            <div class="bg-white rounded-lg shadow p-6 mb-8">
                <h2 class="text-lg font-semibold text-gray-900 mb-4">
                    <i class="fas fa-funnel-dollar mr-2"></i>
                    Conversion Funnel (Last 30 Days)
                </h2>
                <canvas id="funnelChart" height="80"></canvas>
            </div>

            <!-- Real-time Events -->
            <div class="bg-white rounded-lg shadow p-6">
                <h2 class="text-lg font-semibold text-gray-900 mb-4">
                    <i class="fas fa-stream mr-2"></i>
                    Real-time Events
                </h2>
                <div class="space-y-3" id="eventsList">
                    <!-- Events will be populated here -->
                </div>
            </div>
        </div>
    </div>

    <script>
        // Initialize funnel chart
        const ctx = document.getElementById('funnelChart').getContext('2d');
        const funnelChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Messages', 'Images', 'Analyses', 'Quotes', 'Payments Initiated', 'Payments Completed'],
                datasets: [{
                    label: 'Conversion Funnel',
                    data: [1000, 850, 720, 650, 400, 380],
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.8)',
                        'rgba(99, 102, 241, 0.8)',
                        'rgba(139, 92, 246, 0.8)',
                        'rgba(168, 85, 247, 0.8)',
                        'rgba(217, 70, 239, 0.8)',
                        'rgba(16, 185, 129, 0.8)'
                    ]
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true
                    }
                }
            }
        });

        // Fetch and update metrics
        async function updateMetrics() {
            try {
                // This would fetch real data from the API
                console.log('Updating metrics...');
            } catch (error) {
                console.error('Failed to update metrics:', error);
            }
        }

        // Update metrics every 30 seconds
        setInterval(updateMetrics, 30000);
        updateMetrics();
    </script>
</body>
</html>
  `);
});

// Main landing page
app.get('/', (c) => {
  return c.html(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SnapQuote - AI-Powered Instant Quotes via WhatsApp</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gradient-to-br from-blue-50 to-purple-50">
    <div class="min-h-screen flex items-center justify-center px-4">
        <div class="max-w-4xl mx-auto text-center">
            <div class="mb-8">
                <i class="fas fa-camera text-6xl text-blue-600 mb-4"></i>
                <h1 class="text-5xl font-bold text-gray-900 mb-4">SnapQuote</h1>
                <p class="text-xl text-gray-600">
                    AI-Powered Instant Quotes via WhatsApp
                </p>
            </div>

            <div class="bg-white rounded-2xl shadow-xl p-8 mb-8">
                <h2 class="text-2xl font-semibold text-gray-800 mb-6">
                    Transform Your Service Business
                </h2>
                
                <div class="grid md:grid-cols-3 gap-6 mb-8">
                    <div class="text-center">
                        <div class="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                            <i class="fas fa-mobile-alt text-blue-600 text-2xl"></i>
                        </div>
                        <h3 class="font-semibold mb-2">WhatsApp Integration</h3>
                        <p class="text-sm text-gray-600">Customers send photos directly via WhatsApp</p>
                    </div>
                    
                    <div class="text-center">
                        <div class="bg-purple-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                            <i class="fas fa-brain text-purple-600 text-2xl"></i>
                        </div>
                        <h3 class="font-semibold mb-2">AI Analysis</h3>
                        <p class="text-sm text-gray-600">Advanced image recognition in under 15 seconds</p>
                    </div>
                    
                    <div class="text-center">
                        <div class="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                            <i class="fas fa-dollar-sign text-green-600 text-2xl"></i>
                        </div>
                        <h3 class="font-semibold mb-2">Instant Quotes</h3>
                        <p class="text-sm text-gray-600">Automated quotes with integrated payments</p>
                    </div>
                </div>

                <div class="flex flex-col sm:flex-row gap-4 justify-center">
                    <a href="/dashboard" class="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition">
                        <i class="fas fa-chart-line mr-2"></i>
                        View Dashboard
                    </a>
                    <a href="/api/health" class="bg-gray-200 text-gray-800 px-8 py-3 rounded-lg font-semibold hover:bg-gray-300 transition">
                        <i class="fas fa-heartbeat mr-2"></i>
                        System Health
                    </a>
                </div>
            </div>

            <div class="text-sm text-gray-500">
                <p>Performance: 99.5% Uptime | <15s Response Time | 95%+ Payment Success</p>
            </div>
        </div>
    </div>
</body>
</html>
  `);
});

export default app;