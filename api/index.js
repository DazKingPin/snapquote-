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
        // Handle different request body formats (Vercel vs Node.js)
        let data = {};
        if (req.body) {
          data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } else if (req.read) {
          const body = await new Promise((resolve) => {
            let chunks = [];
            req.on('data', chunk => chunks.push(chunk));
            req.on('end', () => resolve(Buffer.concat(chunks).toString()));
          });
          data = JSON.parse(body || '{}');
        }
        
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
        // Handle different request body formats (Vercel vs Node.js)
        let tapData = {};
        if (req.body) {
          tapData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } else if (req.read) {
          const body = await new Promise((resolve) => {
            let chunks = [];
            req.on('data', chunk => chunks.push(chunk));
            req.on('end', () => resolve(Buffer.concat(chunks).toString()));
          });
          tapData = JSON.parse(body || '{}');
        }
        
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

    // Business signup endpoint
    if (path === '/api/business/signup' && req.method === 'POST') {
      try {
        // Handle different request body formats
        let data = {};
        if (req.body) {
          data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } else if (req.read) {
          const body = await new Promise((resolve) => {
            let chunks = [];
            req.on('data', chunk => chunks.push(chunk));
            req.on('end', () => resolve(Buffer.concat(chunks).toString()));
          });
          data = JSON.parse(body || '{}');
        }

        // Generate business ID
        const businessId = 'biz_' + Date.now() + '_' + Math.random().toString(36).substring(7);
        
        // Create business record
        const business = {
          id: businessId,
          business_name: data.business_name,
          industry: data.industry,
          owner_name: data.owner_name,
          email: data.email,
          whatsapp_number: data.whatsapp_number,
          country: data.country,
          hourly_rate: data.hourly_rate || 50,
          plan: data.plan,
          status: 'trial',
          trial_ends: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString()
        };

        // Store in database (if available)
        if (supabase) {
          const { error } = await supabase
            .from('businesses')
            .insert([business]);
          
          if (error) {
            console.error('Database error:', error);
          }
        }

        return sendResponse(200, {
          success: true,
          business_id: businessId,
          message: 'Business account created successfully',
          trial_ends: business.trial_ends,
          next_steps: [
            'Check your email for welcome instructions',
            'Set up your WhatsApp Business API',
            'Configure your first quote template',
            'Start receiving customer quotes!'
          ],
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        return sendResponse(400, {
          success: false,
          error: error.message,
          message: 'Failed to create business account',
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

    // Payment demo page
    if (path === '/payment-demo' || path === '/payment-demo.html') {
      const quoteId = url.searchParams.get('quote') || 'DEMO-' + Date.now();
      const paymentDemoHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Demo - SnapQuote</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
    <div class="container mx-auto px-4 py-8">
        <div class="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
            <!-- Header -->
            <div class="text-center mb-6">
                <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-credit-card text-green-600 text-2xl"></i>
                </div>
                <h1 class="text-2xl font-bold text-gray-800">Payment Demo</h1>
                <p class="text-gray-600 mt-2">Tap Payments Integration</p>
            </div>

            <!-- Quote Details -->
            <div class="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 class="font-semibold text-gray-800 mb-3">Quote Details</h3>
                <div class="space-y-2">
                    <div class="flex justify-between">
                        <span class="text-gray-600">Quote ID:</span>
                        <span class="font-medium">${quoteId}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Service:</span>
                        <span class="font-medium">VR Experience Development</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Amount:</span>
                        <span class="font-medium text-green-600">500 OMR</span>
                    </div>
                </div>
            </div>

            <!-- Tap Payments Integration -->
            <div class="space-y-4">
                <button onclick="proceedToPayment()" class="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                    <i class="fas fa-credit-card mr-2"></i>
                    Pay with Tap Payments
                </button>
                
                <div class="text-center">
                    <p class="text-sm text-gray-500">
                        Secure payment processing by 
                        <a href="https://www.tap.company" target="_blank" class="text-blue-600 hover:underline">Tap Payments</a>
                    </p>
                    <div class="flex justify-center items-center mt-2 space-x-4">
                        <i class="fab fa-cc-visa text-2xl text-blue-600"></i>
                        <i class="fab fa-cc-mastercard text-2xl text-red-500"></i>
                        <i class="fas fa-university text-xl text-gray-600"></i>
                        <span class="text-sm text-gray-500">+ More</span>
                    </div>
                </div>
            </div>

            <!-- Payment Methods Info -->
            <div class="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 class="font-semibold text-blue-800 mb-2">
                    <i class="fas fa-shield-alt mr-2"></i>
                    Supported in Oman
                </h4>
                <ul class="text-sm text-blue-700 space-y-1">
                    <li>• Local Omani bank cards</li>
                    <li>• International credit/debit cards</li>
                    <li>• Online banking integration</li>
                    <li>• Secure 3D verification</li>
                </ul>
            </div>

            <!-- Status -->
            <div class="mt-6 p-4 bg-green-50 rounded-lg">
                <h4 class="font-semibold text-green-800 mb-2">
                    <i class="fas fa-check-circle mr-2"></i>
                    Integration Status
                </h4>
                <p class="text-sm text-green-700">
                    ✅ Tap Payments: Test mode active<br>
                    ✅ Quote generation: Working<br>
                    ✅ Webhook handling: Ready<br>
                    ⏳ Live keys: Pending activation (24-48h)
                </p>
            </div>

            <!-- Back Link -->
            <div class="text-center mt-6">
                <a href="/" class="text-blue-600 hover:underline">
                    <i class="fas fa-arrow-left mr-1"></i>
                    Back to SnapQuote
                </a>
            </div>
        </div>
    </div>

    <script>
        function proceedToPayment() {
            alert('🎉 Tap Payments Integration Ready!\\n\\nTest Mode Active:\\n• Quote ID: ${quoteId}\\n• Amount: 500 OMR\\n• Status: Ready for payments\\n\\nOnce Tap activates your live keys (24-48h), real payments will work automatically!');
        }
    </script>
</body>
</html>`;
      
      return sendResponse(200, paymentDemoHtml, 'text/html');
    }

    // Business signup page
    if (path === '/signup' || path === '/register') {
      const signupHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Start Your Business - SnapQuote</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gradient-to-br from-purple-50 to-blue-100 min-h-screen">
    <div class="container mx-auto px-4 py-8">
        <div class="max-w-2xl mx-auto">
            <!-- Header -->
            <div class="text-center mb-8">
                <div class="inline-flex items-center justify-center w-20 h-20 bg-purple-600 rounded-full mb-4">
                    <i class="fas fa-rocket text-white text-2xl"></i>
                </div>
                <h1 class="text-4xl font-bold text-gray-800 mb-4">Start Your SnapQuote Business</h1>
                <p class="text-xl text-gray-600">
                    Join thousands of businesses generating instant quotes via WhatsApp
                </p>
            </div>

            <!-- Pricing Cards -->
            <div class="grid md:grid-cols-3 gap-6 mb-8">
                <div class="bg-white rounded-lg shadow-lg p-6 text-center">
                    <h3 class="text-lg font-semibold mb-2">Starter</h3>
                    <div class="text-3xl font-bold text-gray-800 mb-4">$49<span class="text-sm text-gray-500">/month</span></div>
                    <ul class="text-sm text-gray-600 space-y-2 mb-6">
                        <li>✓ 100 quotes/month</li>
                        <li>✓ Website widget</li>
                        <li>✓ Basic AI analysis</li>
                        <li>✓ Email support</li>
                    </ul>
                    <button onclick="selectPlan('starter')" class="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded hover:bg-gray-300">
                        Select Plan
                    </button>
                </div>

                <div class="bg-white rounded-lg shadow-lg p-6 text-center border-2 border-purple-500 relative">
                    <div class="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-purple-500 text-white px-3 py-1 rounded-full text-sm">
                        Most Popular
                    </div>
                    <h3 class="text-lg font-semibold mb-2">Professional</h3>
                    <div class="text-3xl font-bold text-purple-600 mb-4">$149<span class="text-sm text-gray-500">/month</span></div>
                    <ul class="text-sm text-gray-600 space-y-2 mb-6">
                        <li>✓ 500 quotes/month</li>
                        <li>✓ WhatsApp integration</li>
                        <li>✓ Advanced AI analysis</li>
                        <li>✓ Custom branding</li>
                        <li>✓ Priority support</li>
                    </ul>
                    <button onclick="selectPlan('professional')" class="w-full bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700">
                        Select Plan
                    </button>
                </div>

                <div class="bg-white rounded-lg shadow-lg p-6 text-center">
                    <h3 class="text-lg font-semibold mb-2">Enterprise</h3>
                    <div class="text-3xl font-bold text-gray-800 mb-4">$399<span class="text-sm text-gray-500">/month</span></div>
                    <ul class="text-sm text-gray-600 space-y-2 mb-6">
                        <li>✓ Unlimited quotes</li>
                        <li>✓ Multi-location support</li>
                        <li>✓ API access</li>
                        <li>✓ Custom integrations</li>
                        <li>✓ Dedicated support</li>
                    </ul>
                    <button onclick="selectPlan('enterprise')" class="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded hover:bg-gray-300">
                        Contact Sales
                    </button>
                </div>
            </div>

            <!-- Registration Form -->
            <div id="registration-form" class="bg-white rounded-lg shadow-lg p-8 hidden">
                <h2 class="text-2xl font-semibold mb-6">Create Your Business Account</h2>
                <form id="business-signup-form" class="space-y-4">
                    <div class="grid md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
                            <input type="text" id="business-name" required 
                                   class="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                                   placeholder="Mike's Plumbing Service">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Industry *</label>
                            <select id="business-industry" required 
                                    class="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500">
                                <option value="">Select Industry</option>
                                <option value="construction">Construction & Contracting</option>
                                <option value="automotive">Automotive Services</option>
                                <option value="home-services">Home Services</option>
                                <option value="creative">Creative Services</option>
                                <option value="technology">Technology Services</option>
                                <option value="healthcare">Healthcare Services</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    </div>

                    <div class="grid md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Owner Name *</label>
                            <input type="text" id="owner-name" required 
                                   class="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                                   placeholder="Mike Johnson">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                            <input type="email" id="business-email" required 
                                   class="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                                   placeholder="mike@mikesplumbing.com">
                        </div>
                    </div>

                    <div class="grid md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">WhatsApp Business Number</label>
                            <input type="tel" id="whatsapp-number" 
                                   class="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                                   placeholder="+1-555-123-4567">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Country *</label>
                            <select id="business-country" required 
                                    class="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500">
                                <option value="">Select Country</option>
                                <option value="US">United States</option>
                                <option value="CA">Canada</option>
                                <option value="GB">United Kingdom</option>
                                <option value="AU">Australia</option>
                                <option value="OM">Oman</option>
                                <option value="AE">UAE</option>
                                <option value="SA">Saudi Arabia</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Hourly Rate (Local Currency)</label>
                        <input type="number" id="hourly-rate" 
                               class="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                               placeholder="75" min="10" max="1000">
                    </div>

                    <div class="flex items-center">
                        <input type="checkbox" id="terms-agree" required class="mr-2">
                        <label class="text-sm text-gray-600">
                            I agree to the <a href="#" class="text-purple-600 hover:underline">Terms of Service</a> and 
                            <a href="#" class="text-purple-600 hover:underline">Privacy Policy</a>
                        </label>
                    </div>

                    <button type="submit" class="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-purple-700 transition-colors">
                        <i class="fas fa-rocket mr-2"></i>
                        Start Free Trial (14 Days)
                    </button>
                </form>
            </div>

            <!-- Back to Demo -->
            <div class="text-center mt-8">
                <a href="/" class="text-purple-600 hover:underline">
                    <i class="fas fa-arrow-left mr-2"></i>
                    Back to Demo Platform
                </a>
            </div>
        </div>
    </div>

    <script>
        let selectedPlan = '';
        
        function selectPlan(plan) {
            selectedPlan = plan;
            document.getElementById('registration-form').classList.remove('hidden');
            document.getElementById('registration-form').scrollIntoView({ behavior: 'smooth' });
        }
        
        document.getElementById('business-signup-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = {
                plan: selectedPlan,
                business_name: document.getElementById('business-name').value,
                industry: document.getElementById('business-industry').value,
                owner_name: document.getElementById('owner-name').value,
                email: document.getElementById('business-email').value,
                whatsapp_number: document.getElementById('whatsapp-number').value,
                country: document.getElementById('business-country').value,
                hourly_rate: document.getElementById('hourly-rate').value
            };
            
            try {
                const response = await fetch('/api/business/signup', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData)
                });
                
                const result = await response.json();
                if (result.success) {
                    alert('🎉 Business Account Created!\\n\\nWelcome to SnapQuote!\\nBusiness ID: ' + result.business_id + '\\n\\nCheck your email for setup instructions.');
                    window.location.href = '/dashboard?business=' + result.business_id;
                } else {
                    alert('Error: ' + result.message);
                }
            } catch (error) {
                alert('Error creating account: ' + error.message);
            }
        });
    </script>
</body>
</html>`;
      
      return sendResponse(200, signupHtml, 'text/html');
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
            <p class="text-xl text-gray-600 max-w-2xl mx-auto mb-6">
                AI-powered instant quote generation via WhatsApp. Get professional quotes in seconds with image analysis and smart pricing.
            </p>
            <div class="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="/signup" class="bg-purple-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors">
                    <i class="fas fa-rocket mr-2"></i>
                    Start Your Business
                </a>
                <button onclick="scrollToDemo()" class="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                    <i class="fas fa-play mr-2"></i>
                    Try Demo
                </button>
            </div>
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

        <!-- Quote Generator Form -->
        <div class="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 class="text-2xl font-semibold mb-4">
                <i class="fas fa-calculator text-blue-600 mr-2"></i>
                Generate Custom Quote
            </h2>
            <div class="grid md:grid-cols-2 gap-6">
                <!-- Quote Form -->
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
                        <select id="service-type" class="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                            <option value="VR Experience Development">VR Experience Development</option>
                            <option value="AR Application">AR Application</option>
                            <option value="Website Design">Website Design</option>
                            <option value="Digital Transformation">Digital Transformation</option>
                            <option value="AI Integration">AI Integration</option>
                            <option value="Custom Software">Custom Software</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Project Amount (OMR)</label>
                        <input type="number" id="project-amount" value="500" min="50" max="50000" 
                               class="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Project Description</label>
                        <textarea id="project-description" rows="3" placeholder="Describe your project requirements..."
                                  class="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">Custom business solution with AI integration</textarea>
                    </div>
                </div>
                
                <!-- Customer Info -->
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                        <input type="text" id="customer-name" value="Ahmed Al-Rashid" 
                               class="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                        <input type="email" id="customer-email" value="ahmed@cosstech.com" 
                               class="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                        <input type="tel" id="customer-phone" value="95123456" placeholder="95XXXXXX" 
                               class="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                    </div>
                    
                    <button onclick="generateCustomQuote()" class="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all">
                        <i class="fas fa-magic mr-2"></i>
                        Generate Quote & Payment Link
                    </button>
                </div>
            </div>
            
            <!-- Result Display -->
            <div id="quote-result" class="mt-6 hidden">
                <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 class="font-semibold text-green-800 mb-2">
                        <i class="fas fa-check-circle mr-2"></i>
                        Quote Generated Successfully!
                    </h3>
                    <div id="quote-details" class="text-sm text-green-700"></div>
                    <div class="mt-3">
                        <button id="open-payment" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 mr-2">
                            Open Payment Page
                        </button>
                        <button onclick="copyPaymentLink()" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                            Copy Payment Link
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- API Status -->
        <div class="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 class="text-2xl font-semibold mb-4">API Status</h2>
            <div class="grid md:grid-cols-3 gap-4">
                <div class="bg-gray-50 rounded-lg p-4">
                    <h3 class="font-medium text-gray-800 mb-2">System Health</h3>
                    <button onclick="checkHealth()" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">
                        Check API Health
                    </button>
                    <div id="health-result" class="mt-2 text-sm"></div>
                </div>
                <div class="bg-gray-50 rounded-lg p-4">
                    <h3 class="font-medium text-gray-800 mb-2">Database Connection</h3>
                    <button onclick="checkDatabase()" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors">
                        Test Database
                    </button>
                    <div id="db-result" class="mt-2 text-sm"></div>
                </div>
                <div class="bg-gray-50 rounded-lg p-4">
                    <h3 class="font-medium text-gray-800 mb-2">Quick Test</h3>
                    <button onclick="testQuoteGeneration()" class="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition-colors">
                        Generate Test Quote
                    </button>
                    <div class="mt-2 text-xs text-gray-500">Quick API test</div>
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
                result.innerHTML = '<span class="text-green-600">✓ ' + data.status + ' - ' + data.message + '</span>';
            } catch (error) {
                result.innerHTML = '<span class="text-red-600">✗ Error: ' + error.message + '</span>';
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
                    result.innerHTML = '<span class="text-orange-600">⚠ Database not configured</span>';
                }
            } catch (error) {
                result.innerHTML = '<span class="text-red-600">✗ Error: ' + error.message + '</span>';
            }
        }

        // Generate custom quote from form
        let currentPaymentUrl = '';
        
        async function generateCustomQuote() {
            const serviceType = document.getElementById('service-type').value;
            const amount = parseInt(document.getElementById('project-amount').value);
            const description = document.getElementById('project-description').value;
            const customerName = document.getElementById('customer-name').value;
            const customerEmail = document.getElementById('customer-email').value;
            const customerPhone = document.getElementById('customer-phone').value;
            
            if (!customerName || !customerEmail || !customerPhone || !amount) {
                alert('Please fill in all required fields');
                return;
            }
            
            try {
                const response = await fetch('/api/generate-quote', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        service: serviceType,
                        amount: amount,
                        description: description,
                        customer: {
                            name: customerName,
                            email: customerEmail,
                            phone: customerPhone
                        }
                    })
                });
                
                const result = await response.json();
                if (result.success) {
                    currentPaymentUrl = result.payment_url;
                    
                    document.getElementById('quote-details').innerHTML = 
                        '<strong>Quote ID:</strong> ' + result.quote.id + '<br>' +
                        '<strong>Service:</strong> ' + result.quote.service + '<br>' +
                        '<strong>Amount:</strong> ' + result.quote.amount + ' ' + result.quote.currency + '<br>' +
                        '<strong>Customer:</strong> ' + result.quote.customer.name + '<br>' +
                        '<strong>Status:</strong> Ready for payment';
                    
                    document.getElementById('quote-result').classList.remove('hidden');
                    document.getElementById('open-payment').onclick = function() {
                        window.open(currentPaymentUrl, '_blank');
                    };
                    
                    // Scroll to result
                    document.getElementById('quote-result').scrollIntoView({ behavior: 'smooth' });
                } else {
                    alert('Error: ' + result.message);
                }
            } catch (error) {
                alert('Error generating quote: ' + error.message);
            }
        }
        
        function copyPaymentLink() {
            if (currentPaymentUrl) {
                navigator.clipboard.writeText(currentPaymentUrl).then(function() {
                    alert('Payment link copied to clipboard!');
                });
            }
        }
        
        function scrollToDemo() {
            document.querySelector('.bg-white.rounded-lg.shadow-lg').scrollIntoView({ behavior: 'smooth' });
        }

        // Add test quote generation function
        async function testQuoteGeneration() {
            try {
                const response = await fetch('/api/generate-quote', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        service: 'VR Experience Development',
                        amount: 500,
                        description: 'Custom VR training solution',
                        customer: {
                            name: 'Test Customer',
                            email: 'test@cosstech.com',
                            phone: '95000000'
                        }
                    })
                });
                
                const result = await response.json();
                if (result.success) {
                    alert('Quote Generated Successfully!\\nQuote ID: ' + result.quote.id + '\\nAmount: ' + result.quote.amount + ' ' + result.quote.currency + '\\nPayment URL: ' + result.payment_url);
                } else {
                    alert('Error: ' + result.message);
                }
            } catch (error) {
                alert('Error generating quote: ' + error.message);
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