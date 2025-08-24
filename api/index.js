import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  try {
    // Health check endpoint
    if (path === '/api/health') {
      const dbStatus = supabase ? 'connected' : 'not configured';
      return res.status(200).json({
        status: 'healthy',
        message: 'SnapQuote API is running!',
        database: dbStatus,
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    }

    // Test database connection
    if (path === '/api/db-test' && supabase) {
      const { data, error } = await supabase
        .from('merchants')
        .select('count(*)')
        .limit(1);
      
      return res.status(200).json({
        message: 'Database connection test',
        success: !error,
        error: error?.message || null,
        timestamp: new Date().toISOString()
      });
    }

    // Quote generation endpoint (placeholder)
    if (path === '/api/generate-quote' && req.method === 'POST') {
      // This will be expanded with OpenAI integration
      return res.status(200).json({
        message: 'Quote generation endpoint',
        status: 'under development',
        timestamp: new Date().toISOString()
      });
    }

    // WhatsApp webhook endpoint (placeholder)
    if (path === '/api/webhook/whatsapp' && req.method === 'POST') {
      return res.status(200).json({
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

      return res.status(200).json({
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
      
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    }

    // 404 for unknown routes
    return res.status(404).json({
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
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}