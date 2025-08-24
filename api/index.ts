// SnapQuote Main API Handler for Vercel
import { Hono } from 'hono';
// import { handle } from 'hono/vercel';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { sql, checkDatabaseHealth } from '../lib/database/supabase';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Create Hono app
const app = new Hono().basePath('/api');

// Enable CORS
app.use('*', cors({
  origin: ['https://snapquote.vercel.app', 'http://localhost:3000'],
  credentials: true
}));

// Health check endpoint
app.get('/health', async (c) => {
  try {
    const dbHealthy = await checkDatabaseHealth();
    
    return c.json({
      status: dbHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      database: dbHealthy ? 'connected' : 'disconnected',
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
app.get('/webhook/whatsapp', (c) => {
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return c.text(challenge || '');
  }
  
  return c.text('Forbidden', 403);
});

// WhatsApp webhook handler
app.post('/webhook/whatsapp', async (c) => {
  try {
    const webhook = await c.req.json();
    
    // Track webhook received
    await sql`
      INSERT INTO system_events (event_type, processing_time_ms, success, metadata)
      VALUES ('whatsapp_message_received', ${Date.now()}, true, ${JSON.stringify(webhook)})
    `;
    
    // Process webhook (implement your webhook processing logic here)
    console.log('WhatsApp webhook received:', webhook);
    
    return c.json({ success: true });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});

// Stripe webhook handler
app.post('/webhook/stripe', async (c) => {
  const signature = c.req.header('stripe-signature');
  
  if (!signature) {
    return c.json({ error: 'Missing signature' }, 400);
  }

  try {
    const rawBody = await c.req.text();
    
    // Process Stripe webhook (implement your Stripe webhook processing here)
    console.log('Stripe webhook received');
    
    return c.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return c.json({ error: 'Webhook processing failed' }, 400);
  }
});

// AI Analysis endpoint
const analyzeImageSchema = z.object({
  merchant_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  image_url: z.string().url(),
  media_id: z.string().optional()
});

app.post('/analyze',
  zValidator('json', analyzeImageSchema),
  async (c) => {
    const data = c.req.valid('json');
    const startTime = Date.now();

    try {
      // Get merchant
      const merchants = await sql`
        SELECT * FROM merchants WHERE id = ${data.merchant_id}
      `;

      if (merchants.length === 0) {
        return c.json({
          success: false,
          error: 'Merchant not found'
        }, 404);
      }

      const merchant = merchants[0];

      // Simulate AI analysis (replace with actual OpenAI call)
      const processingTime = Date.now() - startTime;
      
      const analysis = {
        id: crypto.randomUUID(),
        merchant_id: data.merchant_id,
        customer_id: data.customer_id,
        image_url: data.image_url,
        analysis_result: {
          description: 'Test analysis result',
          confidence: 0.85,
          detected_items: [
            {
              item: 'Window',
              confidence: 0.9,
              quantity: 4
            }
          ]
        },
        ai_confidence: 0.85,
        processing_time_ms: processingTime
      };

      // Store analysis
      await sql`
        INSERT INTO image_analyses (
          id, merchant_id, customer_id, image_url, whatsapp_media_id,
          analysis_result, ai_confidence, processing_time_ms
        ) VALUES (
          ${analysis.id}, ${data.merchant_id}, ${data.customer_id}, 
          ${data.image_url}, ${data.media_id || null},
          ${JSON.stringify(analysis.analysis_result)}, ${analysis.ai_confidence}, 
          ${processingTime}
        )
      `;

      // Track event
      await sql`
        INSERT INTO system_events (event_type, merchant_id, processing_time_ms, success, metadata)
        VALUES ('ai_analysis_completed', ${data.merchant_id}, ${processingTime}, true, ${JSON.stringify({ analysis_id: analysis.id })})
      `;

      return c.json({
        success: true,
        data: analysis,
        metadata: {
          processing_time_ms: processingTime,
          timestamp: new Date().toISOString(),
          request_id: crypto.randomUUID()
        }
      });

    } catch (error) {
      console.error('Analysis error:', error);
      
      await sql`
        INSERT INTO system_events (event_type, merchant_id, processing_time_ms, success, error_message, metadata)
        VALUES ('error_occurred', ${data.merchant_id}, ${Date.now() - startTime}, false, ${error instanceof Error ? error.message : 'Unknown error'}, ${JSON.stringify({ type: 'image_analysis' })})
      `;

      return c.json({
        success: false,
        error: 'Analysis failed'
      }, 500);
    }
  }
);

// Generate quote endpoint
const generateQuoteSchema = z.object({
  merchant_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  analysis_id: z.string().uuid()
});

app.post('/quotes/generate',
  zValidator('json', generateQuoteSchema),
  async (c) => {
    const data = c.req.valid('json');
    const startTime = Date.now();

    try {
      // Get merchant, customer, and analysis
      const [merchants, customers, analyses] = await Promise.all([
        sql`SELECT * FROM merchants WHERE id = ${data.merchant_id}`,
        sql`SELECT * FROM customers WHERE id = ${data.customer_id}`,
        sql`SELECT * FROM image_analyses WHERE id = ${data.analysis_id}`
      ]);

      if (merchants.length === 0 || customers.length === 0 || analyses.length === 0) {
        return c.json({
          success: false,
          error: 'Required data not found'
        }, 404);
      }

      const merchant = merchants[0];
      const customer = customers[0];
      const analysis = analyses[0];

      // Generate quote
      const processingTime = Date.now() - startTime;
      const quoteNumber = `QUO-${Date.now()}`;
      
      const quote = {
        id: crypto.randomUUID(),
        merchant_id: data.merchant_id,
        customer_id: data.customer_id,
        analysis_id: data.analysis_id,
        quote_number: quoteNumber,
        items: [
          {
            description: 'Window Cleaning Service',
            quantity: 4,
            unit: 'windows',
            unit_price: 25.00,
            total_price: 100.00
          }
        ],
        subtotal: 100.00,
        tax_rate: 0.08,
        tax_amount: 8.00,
        discount_amount: 0.00,
        total_amount: 108.00,
        status: 'pending',
        generation_time_ms: processingTime
      };

      // Store quote
      await sql`
        INSERT INTO quotes (
          id, merchant_id, customer_id, analysis_id, quote_number,
          items, subtotal, tax_rate, tax_amount, discount_amount,
          total_amount, status, generation_time_ms
        ) VALUES (
          ${quote.id}, ${data.merchant_id}, ${data.customer_id}, ${data.analysis_id},
          ${quoteNumber}, ${JSON.stringify(quote.items)}, ${quote.subtotal},
          ${quote.tax_rate}, ${quote.tax_amount}, ${quote.discount_amount},
          ${quote.total_amount}, ${quote.status}, ${processingTime}
        )
      `;

      // Track quote generation
      await sql`
        INSERT INTO system_events (event_type, merchant_id, processing_time_ms, success, metadata)
        VALUES ('quote_generated', ${data.merchant_id}, ${processingTime}, true, ${JSON.stringify({ quote_id: quote.id, amount: quote.total_amount })})
      `;

      return c.json({
        success: true,
        data: {
          quote,
          payment_link: `https://checkout.stripe.com/pay/${quote.id}` // This would be generated by Stripe
        },
        metadata: {
          processing_time_ms: processingTime,
          timestamp: new Date().toISOString(),
          request_id: crypto.randomUUID()
        }
      });

    } catch (error) {
      console.error('Quote generation error:', error);
      return c.json({
        success: false,
        error: 'Quote generation failed'
      }, 500);
    }
  }
);

// Performance metrics endpoint
app.get('/metrics/:merchant_id', async (c) => {
  const merchantId = c.req.param('merchant_id');
  const days = parseInt(c.req.query('days') || '30');
  
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get performance metrics
    const metrics = await sql`
      SELECT 
        COUNT(DISTINCT CASE WHEN event_type = 'whatsapp_message_received' THEN created_at END) as messages_received,
        COUNT(DISTINCT CASE WHEN event_type = 'ai_analysis_completed' THEN created_at END) as analyses_completed,
        COUNT(DISTINCT CASE WHEN event_type = 'quote_generated' THEN created_at END) as quotes_generated,
        COUNT(DISTINCT CASE WHEN event_type = 'payment_completed' THEN created_at END) as payments_completed,
        AVG(CASE WHEN event_type = 'quote_generated' THEN processing_time_ms END) as avg_quote_time,
        AVG(CASE WHEN event_type = 'ai_analysis_completed' THEN processing_time_ms END) as avg_analysis_time
      FROM system_events
      WHERE merchant_id = ${merchantId} AND created_at >= ${startDate.toISOString()}
    `;

    return c.json({
      success: true,
      data: {
        performance: metrics[0],
        period_days: days
      },
      metadata: {
        processing_time_ms: 0,
        timestamp: new Date().toISOString(),
        request_id: crypto.randomUUID()
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: 'Failed to retrieve metrics'
    }, 500);
  }
});

// Export the Hono app for Vercel
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return app.fetch(req as any, {} as any, {} as any);
}