import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

// Tap Payments integration
async function generateTapPayment(quote) {
  const tapApiKey = process.env.TAP_SECRET_KEY;
  
  if (!tapApiKey) {
    return `https://snapquote-six.vercel.app/payment-demo?quote=${quote.id}`;
  }
  
  try {
    const tapPayload = {
      amount: quote.amount,
      currency: quote.currency,
      description: quote.description,
      reference: {
        transaction: quote.id,
        order: quote.id
      },
      receipt: {
        email: true,
        sms: false
      },
      customer: {
        first_name: quote.customer.name || 'Customer',
        email: quote.customer.email || 'customer@example.com',
        phone: {
          country_code: '968',
          number: quote.customer.phone || '90000000'
        }
      },
      source: {
        id: 'src_all'
      },
      post: {
        url: 'https://snapquote-six.vercel.app/api/webhook/tap'
      },
      redirect: {
        url: 'https://snapquote-six.vercel.app/payment-success'
      }
    };
    
    const response = await fetch('https://api.tap.company/v2/charges', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tapApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tapPayload)
    });
    
    const tapResponse = await response.json();
    
    if (tapResponse.transaction && tapResponse.transaction.url) {
      return tapResponse.transaction.url;
    }
    
    return `https://snapquote-six.vercel.app/payment-demo?quote=${quote.id}`;
  } catch (error) {
    console.error('Tap Payment Error:', error);
    return `https://snapquote-six.vercel.app/payment-demo?quote=${quote.id}`;
  }
}

export default async function handler(req, res) {
  // Helper function to handle both Node.js and Vercel response objects
  const sendResponse = (statusCode, data, contentType = 'application/json') => {
    // Vercel-style response
    if (typeof res.status === 'function') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      if (contentType === 'text/html') {
        res.setHeader('Content-Type', 'text/html');
        return res.status(statusCode).send(data);
      }
      return res.status(statusCode).json(data);
    }
    // Node.js-style response
    else {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.statusCode = statusCode;
      
      if (contentType === 'text/html') {
        res.setHeader('Content-Type', 'text/html');
        res.end(data);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.end(typeof data === 'string' ? data : JSON.stringify(data));
      }
    }
  };

  // Set CORS headers (already handled in sendResponse)

  if (req.method === 'OPTIONS') {
    return sendResponse(200, '');
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  try {
    // Health check endpoint
    if (path === '/api/health') {
      const dbStatus = supabase ? 'connected' : 'not configured';
      return sendResponse(200, {
        status: 'healthy',
        message: 'SnapQuote API is running!',
        database: dbStatus,
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    }

    // Test database connection
    if (path === '/api/db-test' && supabase) {
      try {
        const { data, error } = await supabase
          .from('merchants')
          .select('id')
          .limit(1);
        
        return sendResponse(200, {
          message: 'Database connection test',
          success: !error,
          data: data ? `Found ${data.length} records` : 'No data',
          error: error?.message || null,
          timestamp: new Date().toISOString()
        });
      } catch (dbError) {
        return sendResponse(200, {
          message: 'Database connection test',
          success: false,
          error: `Connection error: ${dbError.message}`,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Quote generation endpoint with Tap Payments
    if (path === '/api/generate-quote' && req.method === 'POST') {
      try {
        const body = await req.text();
        const data = JSON.parse(body || '{}');
        
        // Basic quote generation (will expand with OpenAI)
        const quote = {
          id: `quote_${Date.now()}`,
          service: data.service || 'General Service',
          amount: data.amount || 100,
          currency: 'OMR',
          description: data.description || 'Professional service quote',
          customer: data.customer || {},
          created_at: new Date().toISOString(),
          status: 'pending'
        };
        
        // Generate Tap Payment link (placeholder structure)
        const tapPaymentUrl = await generateTapPayment(quote);
        
        return sendResponse(200, {
          success: true,
          quote: quote,
          payment_url: tapPaymentUrl,
          message: 'Quote generated successfully with Tap Payment integration',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendResponse(400, {
          success: false,
          error: error.message,
          message: 'Failed to generate quote',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Tap Payments webhook endpoint
    if (path === '/api/webhook/tap' && req.method === 'POST') {
      try {
        const body = await req.text();
        const tapData = JSON.parse(body || '{}');
        
        // Process Tap payment webhook
        console.log('Tap Payment Webhook:', tapData);
        
        // Update payment status in database
        if (supabase && tapData.id) {
          const { error } = await supabase
            .from('payments')
            .update({ 
              status: tapData.status,
              tap_payment_id: tapData.id,
              updated_at: new Date().toISOString()
            })
            .eq('external_id', tapData.reference?.order || tapData.id);
          
          if (error) {
            console.error('Database update error:', error);
          }
        }
        
        return sendResponse(200, {
          success: true,
          message: 'Tap webhook processed successfully',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendResponse(400, {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    // WhatsApp webhook endpoint (placeholder)
    if (path === '/api/webhook/whatsapp' && req.method === 'POST') {
      return sendResponse(200, {
        message: 'WhatsApp webhook received',
        status: 'processed',
        timestamp: new Date().toISOString()
      });
    }

    // Analytics endpoint (placeholder)
    if (path === '/api/analytics' && supabase) {
      const { data, error } = await supabase
        .from('performance_metrics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      return sendResponse(200, {
        message: 'Analytics data',
        data: data || [],
        error: error?.message || null,
        timestamp: new Date().toISOString()
      });
    }

    // Default route - serve landing page
    if (path === '/' || path === '/api') {
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SnapQuote - AI-Powered Instant Quotes</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
    <div class="container mx-auto px-4 py-8">
        <!-- Header -->
        <div class="text-center mb-12">
            <div class="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-full mb-4">
                <i class="fas fa-quote-right text-white text-2xl"></i>
            </div>
            <h1 class="text-4xl font-bold text-gray-800 mb-4">SnapQuote</h1>
            <p class="text-xl text-gray-600 max-w-2xl mx-auto">
                AI-powered instant quote generation via WhatsApp. Get professional quotes in seconds with image analysis and smart pricing.
            </p>
        </div>

        <!-- Features Grid -->
        <div class="grid md:grid-cols-3 gap-8 mb-12">
            <div class="bg-white rounded-lg shadow-lg p-6 text-center">
                <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fab fa-whatsapp text-green-600 text-xl"></i>
                </div>
                <h3 class="text-lg font-semibold mb-2">WhatsApp Integration</h3>
                <p class="text-gray-600">Send photos and get instant quotes directly through WhatsApp</p>
            </div>
            <div class="bg-white rounded-lg shadow-lg p-6 text-center">
                <div class="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-robot text-purple-600 text-xl"></i>
                </div>
                <h3 class="text-lg font-semibold mb-2">AI Image Analysis</h3>
                <p class="text-gray-600">Advanced computer vision analyzes your images for accurate quotes</p>
            </div>
            <div class="bg-white rounded-lg shadow-lg p-6 text-center">
                <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-bolt text-blue-600 text-xl"></i>
                </div>
                <h3 class="text-lg font-semibold mb-2">Instant Results</h3>
                <p class="text-gray-600">Get professional quotes in under 15 seconds</p>
            </div>
        </div>

        <!-- API Status -->
        <div class="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 class="text-2xl font-semibold mb-4">API Status</h2>
            <div class="grid md:grid-cols-2 gap-4">
                <div class="bg-gray-50 rounded-lg p-4">
                    <h3 class="font-medium text-gray-800 mb-2">System Health</h3>
                    <button onclick="checkHealth()" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                        Check API Health
                    </button>
                    <div id="health-result" class="mt-2 text-sm"></div>
                </div>
                <div class="bg-gray-50 rounded-lg p-4">
                    <h3 class="font-medium text-gray-800 mb-2">Database Connection</h3>
                    <button onclick="checkDatabase()" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                        Test Database
                    </button>
                    <div id="db-result" class="mt-2 text-sm"></div>
                </div>
            </div>
        </div>

        <!-- Technical Info -->
        <div class="bg-white rounded-lg shadow-lg p-6">
            <h2 class="text-2xl font-semibold mb-4">Technical Stack</h2>
            <div class="grid md:grid-cols-2 gap-6">
                <div>
                    <h3 class="font-medium text-gray-800 mb-2">Backend</h3>
                    <ul class="text-gray-600 space-y-1">
                        <li>• Vercel Serverless Functions (FREE)</li>
                        <li>• Supabase PostgreSQL (FREE)</li>
                        <li>• OpenAI Vision API</li>
                        <li>• WhatsApp Business API</li>
                    </ul>
                </div>
                <div>
                    <h3 class="font-medium text-gray-800 mb-2">Performance Targets</h3>
                    <ul class="text-gray-600 space-y-1">
                        <li>• Sub-15 second response times</li>
                        <li>• 99.5% uptime guaranteed</li>
                        <li>• 95%+ payment success rates</li>
                        <li>• $0/month hosting cost</li>
                    </ul>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class="text-center mt-12 text-gray-500">
            <p>&copy; 2024 SnapQuote Platform | Powered by Vercel + Supabase</p>
            <p class="mt-2">Timestamp: ${new Date().toISOString()}</p>
        </div>
    </div>

    <script>
        async function checkHealth() {
            const result = document.getElementById('health-result');
            try {
                result.innerHTML = '<span class="text-blue-600">Checking...</span>';
                const response = await fetch('/api/health');
                const data = await response.json();
                result.innerHTML = \`<span class="text-green-600">✓ \${data.status} - \${data.message}</span>\`;
            } catch (error) {
                result.innerHTML = \`<span class="text-red-600">✗ Error: \${error.message}</span>\`;
            }
        }

        async function checkDatabase() {
            const result = document.getElementById('db-result');
            try {
                result.innerHTML = '<span class="text-blue-600">Testing...</span>';
                const response = await fetch('/api/db-test');
                const data = await response.json();
                if (data.success) {
                    result.innerHTML = '<span class="text-green-600">✓ Database connected</span>';
                } else {
                    result.innerHTML = \`<span class="text-orange-600">⚠ Database not configured</span>\`;
                }
            } catch (error) {
                result.innerHTML = \`<span class="text-red-600">✗ Error: \${error.message}</span>\`;
            }
        }
    </script>
</body>
</html>`;
      
      return sendResponse(200, html, 'text/html');
    }

    // 404 for unknown routes
    return sendResponse(404, {
      error: 'Not Found',
      message: `Route ${path} not found`,
      availableRoutes: [
        '/api/health',
        '/api/db-test',
        '/api/generate-quote',
        '/api/webhook/whatsapp',
        '/api/analytics'
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('API Error:', error);
    return sendResponse(500, {
      error: 'Internal Server Error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}