import { createClient } from '@supabase/supabase-js';

// Email service for notifications (using Resend - free tier)
async function sendWelcomeEmail(businessData) {
  const resendApiKey = process.env.RESEND_API_KEY;
  
  if (!resendApiKey) {
    console.log('No Resend API key found, email notification skipped');
    return { success: false, message: 'Email service not configured' };
  }
  
  try {
    const emailPayload = {
      from: 'Smartthinkerz <noreply@smartthinkerz.com>',
      to: [businessData.email],
      subject: `Welcome to Smartthinkerz! Your ${businessData.planName} account is ready`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #667eea; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 28px;">🧠 Welcome to Smartthinkerz!</h1>
                <p style="margin: 10px 0 0 0; font-size: 18px;">Your Intelligent Business Solutions Platform</p>
            </div>
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                <h2 style="color: #667eea; margin-top: 0;">Hi ${businessData.businessName}! 👋</h2>
                <p>Congratulations! Your <strong>${businessData.planName}</strong> account has been successfully created.</p>
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                    <h3 style="margin-top: 0; color: #667eea;">📋 Your Account Details</h3>
                    <p><strong>Business:</strong> ${businessData.businessName}</p>
                    <p><strong>Email:</strong> ${businessData.email}</p>
                    <p><strong>Plan:</strong> ${businessData.planName}</p>
                    <p><strong>Business ID:</strong> ${businessData.businessId}</p>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://smartthinkerz.com/dashboard?business=${businessData.businessId}" 
                       style="display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Access Your Dashboard</a>
                </div>
                <p style="color: #666; text-align: center;">Need help? Visit our support center.</p>
            </div>
        </div>
      `
    };
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      return { success: true, emailId: result.id, message: 'Welcome email sent successfully' };
    } else {
      console.error('Failed to send email:', result);
      return { success: false, message: result.message || 'Failed to send email' };
    }
  } catch (error) {
    console.error('Email service error:', error);
    return { success: false, message: 'Email service error' };
  }
}

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
    return `https://smartthinkerz.com/payment-demo?quote=${quote.id}`;
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
        url: 'https://smartthinkerz.com/api/webhook/tap'
      },
      redirect: {
        url: 'https://smartthinkerz.com/payment-success'
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
    
    return `https://smartthinkerz.com/payment-demo?quote=${quote.id}`;
  } catch (error) {
    console.error('Tap Payment Error:', error);
    return `https://smartthinkerz.com/payment-demo?quote=${quote.id}`;
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
        message: 'Smartthinkerz API is running!',
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

        // Send welcome email
        const emailData = {
          businessName: business.business_name,
          email: business.email,
          planName: business.plan || 'Trial',
          businessId: businessId
        };
        
        const emailResult = await sendWelcomeEmail(emailData);
        console.log('Welcome email result:', emailResult);

        return sendResponse(200, {
          success: true,
          business_id: businessId,
          message: 'Business account created successfully',
          trial_ends: business.trial_ends,
          email_sent: emailResult.success,
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
    <title>Payment Demo - Smartthinkerz</title>
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
                    Back to Smartthinkerz
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

    // Business dashboard page
    if (path === '/dashboard') {
      const businessId = url.searchParams.get('business') || 'demo_business_123';
      const dashboardHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Business Dashboard - Smartthinkerz</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body class="bg-gray-100 min-h-screen">
    <!-- Top Navigation -->
    <nav class="bg-white shadow-lg">
        <div class="max-w-7xl mx-auto px-4">
            <div class="flex justify-between h-16">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <h1 class="text-xl font-bold text-purple-600">Smartthinkerz Dashboard</h1>
                    </div>
                </div>
                <div class="flex items-center space-x-4">
                    <span class="text-sm text-gray-600">Business ID: ${businessId}</span>
                    <button class="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">
                        <i class="fas fa-cog mr-1"></i> Settings
                    </button>
                </div>
            </div>
        </div>
    </nav>

    <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <!-- Status Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div class="bg-white overflow-hidden shadow rounded-lg">
                <div class="p-5">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <i class="fas fa-quote-right text-2xl text-blue-500"></i>
                        </div>
                        <div class="ml-5 w-0 flex-1">
                            <dl>
                                <dt class="text-sm font-medium text-gray-500 truncate">Total Quotes</dt>
                                <dd class="text-lg font-medium text-gray-900" id="total-quotes">Loading...</dd>
                            </dl>
                        </div>
                    </div>
                </div>
            </div>

            <div class="bg-white overflow-hidden shadow rounded-lg">
                <div class="p-5">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <i class="fas fa-check-circle text-2xl text-green-500"></i>
                        </div>
                        <div class="ml-5 w-0 flex-1">
                            <dl>
                                <dt class="text-sm font-medium text-gray-500 truncate">Conversion Rate</dt>
                                <dd class="text-lg font-medium text-gray-900" id="conversion-rate">Loading...</dd>
                            </dl>
                        </div>
                    </div>
                </div>
            </div>

            <div class="bg-white overflow-hidden shadow rounded-lg">
                <div class="p-5">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <i class="fas fa-dollar-sign text-2xl text-yellow-500"></i>
                        </div>
                        <div class="ml-5 w-0 flex-1">
                            <dl>
                                <dt class="text-sm font-medium text-gray-500 truncate">Revenue (MTD)</dt>
                                <dd class="text-lg font-medium text-gray-900" id="monthly-revenue">Loading...</dd>
                            </dl>
                        </div>
                    </div>
                </div>
            </div>

            <div class="bg-white overflow-hidden shadow rounded-lg">
                <div class="p-5">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <i class="fab fa-whatsapp text-2xl text-green-600"></i>
                        </div>
                        <div class="ml-5 w-0 flex-1">
                            <dl>
                                <dt class="text-sm font-medium text-gray-500 truncate">WhatsApp Status</dt>
                                <dd class="text-lg font-medium text-gray-900" id="whatsapp-status">Not Connected</dd>
                            </dl>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Main Content -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Left Column -->
            <div class="lg:col-span-2 space-y-6">
                <!-- Quick Actions -->
                <div class="bg-white shadow rounded-lg">
                    <div class="px-4 py-5 sm:p-6">
                        <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">Quick Actions</h3>
                        <div class="grid grid-cols-2 gap-4">
                            <button onclick="generateTestQuote()" class="bg-blue-600 text-white p-4 rounded-lg hover:bg-blue-700 transition-colors">
                                <i class="fas fa-plus-circle mb-2 text-xl"></i>
                                <div class="font-medium">Generate Quote</div>
                                <div class="text-sm opacity-80">Create manual quote</div>
                            </button>
                            
                            <button onclick="setupWhatsApp()" class="bg-green-600 text-white p-4 rounded-lg hover:bg-green-700 transition-colors">
                                <i class="fab fa-whatsapp mb-2 text-xl"></i>
                                <div class="font-medium">Connect WhatsApp</div>
                                <div class="text-sm opacity-80">Set up automation</div>
                            </button>
                            
                            <button onclick="configurePricing()" class="bg-purple-600 text-white p-4 rounded-lg hover:bg-purple-700 transition-colors">
                                <i class="fas fa-cogs mb-2 text-xl"></i>
                                <div class="font-medium">Configure Pricing</div>
                                <div class="text-sm opacity-80">Set rates & rules</div>
                            </button>
                            
                            <button onclick="viewAnalytics()" class="bg-orange-600 text-white p-4 rounded-lg hover:bg-orange-700 transition-colors">
                                <i class="fas fa-chart-line mb-2 text-xl"></i>
                                <div class="font-medium">View Analytics</div>
                                <div class="text-sm opacity-80">Business insights</div>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Recent Quotes -->
                <div class="bg-white shadow rounded-lg">
                    <div class="px-4 py-5 sm:p-6">
                        <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">Recent Quotes</h3>
                        <div id="recent-quotes" class="space-y-3">
                            <!-- Sample data -->
                            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div>
                                    <div class="font-medium">Kitchen Renovation Quote</div>
                                    <div class="text-sm text-gray-500">Customer: Sarah Johnson • 2 hours ago</div>
                                </div>
                                <div class="text-right">
                                    <div class="font-medium text-green-600">$2,500</div>
                                    <div class="text-sm text-gray-500">Paid</div>
                                </div>
                            </div>
                            
                            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div>
                                    <div class="font-medium">Bathroom Repair Quote</div>
                                    <div class="text-sm text-gray-500">Customer: Mike Chen • 5 hours ago</div>
                                </div>
                                <div class="text-right">
                                    <div class="font-medium text-orange-600">$850</div>
                                    <div class="text-sm text-gray-500">Pending</div>
                                </div>
                            </div>
                            
                            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div>
                                    <div class="font-medium">Plumbing Emergency</div>
                                    <div class="text-sm text-gray-500">Customer: Lisa Rodriguez • 1 day ago</div>
                                </div>
                                <div class="text-right">
                                    <div class="font-medium text-green-600">$325</div>
                                    <div class="text-sm text-gray-500">Paid</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="mt-4">
                            <button class="text-purple-600 hover:text-purple-700 font-medium">View All Quotes →</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Column -->
            <div class="space-y-6">
                <!-- Business Info -->
                <div class="bg-white shadow rounded-lg">
                    <div class="px-4 py-5 sm:p-6">
                        <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">Business Profile</h3>
                        <div class="space-y-3">
                            <div>
                                <label class="block text-sm font-medium text-gray-700">Business Name</label>
                                <input type="text" id="business-name-display" value="Demo Construction Co." 
                                       class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-purple-500 focus:border-purple-500">
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-700">Hourly Rate</label>
                                <input type="number" id="hourly-rate-display" value="85" 
                                       class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-purple-500 focus:border-purple-500">
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-700">WhatsApp Number</label>
                                <input type="tel" id="whatsapp-display" value="+1-555-DEMO-123" 
                                       class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-purple-500 focus:border-purple-500">
                            </div>
                            
                            <button onclick="updateProfile()" class="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700">
                                Update Profile
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Setup Progress -->
                <div class="bg-white shadow rounded-lg">
                    <div class="px-4 py-5 sm:p-6">
                        <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">Setup Progress</h3>
                        <div class="space-y-3">
                            <div class="flex items-center">
                                <i class="fas fa-check-circle text-green-500 mr-3"></i>
                                <span class="text-sm">Account created</span>
                            </div>
                            <div class="flex items-center">
                                <i class="fas fa-check-circle text-green-500 mr-3"></i>
                                <span class="text-sm">Basic profile completed</span>
                            </div>
                            <div class="flex items-center">
                                <i class="fas fa-circle text-gray-300 mr-3"></i>
                                <span class="text-sm text-gray-500">WhatsApp connected</span>
                            </div>
                            <div class="flex items-center">
                                <i class="fas fa-circle text-gray-300 mr-3"></i>
                                <span class="text-sm text-gray-500">First quote generated</span>
                            </div>
                        </div>
                        
                        <div class="mt-4">
                            <div class="bg-gray-200 rounded-full h-2">
                                <div class="bg-purple-600 h-2 rounded-full" style="width: 50%"></div>
                            </div>
                            <p class="text-sm text-gray-600 mt-1">50% Complete</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Load dashboard data
        async function loadDashboardData() {
            try {
                // Mock data for demo
                document.getElementById('total-quotes').textContent = '47';
                document.getElementById('conversion-rate').textContent = '68%';
                document.getElementById('monthly-revenue').textContent = '$12,450';
                document.getElementById('whatsapp-status').textContent = 'Demo Mode';
            } catch (error) {
                console.error('Error loading data:', error);
            }
        }

        function generateTestQuote() {
            const businessId = new URLSearchParams(window.location.search).get('business');
            window.location.href = '/create-quote?business=' + businessId;
        }

        function setupWhatsApp() {
            const businessId = new URLSearchParams(window.location.search).get('business');
            window.location.href = '/whatsapp-setup?business=' + businessId;
        }

        function configurePricing() {
            const businessId = new URLSearchParams(window.location.search).get('business');
            window.location.href = '/pricing-config?business=' + businessId;
        }

        function viewAnalytics() {
            const businessId = new URLSearchParams(window.location.search).get('business');
            window.location.href = '/analytics?business=' + businessId;
        }

        function updateProfile() {
            alert('✅ Profile Updated!\\n\\nYour business profile has been updated successfully.');
        }

        // Load data when page loads
        document.addEventListener('DOMContentLoaded', loadDashboardData);
    </script>
</body>
</html>`;
      
      return sendResponse(200, dashboardHtml, 'text/html');
    }

    // Business signup page
    if (path === '/signup' || path === '/register') {
      const signupHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Start Your Business - Smartthinkerz</title>
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
                <h1 class="text-4xl font-bold text-gray-800 mb-4">Start Your Smartthinkerz Business</h1>
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
                            <select id="business-industry" required onchange="toggleOtherIndustry()"
                                    class="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500">
                                <option value="">Select Industry</option>
                                <option value="construction">Construction & Contracting</option>
                                <option value="automotive">Automotive Services</option>
                                <option value="home-services">Home Services</option>
                                <option value="creative">Creative Services</option>
                                <option value="technology">Technology Services</option>
                                <option value="healthcare">Healthcare Services</option>
                                <option value="consulting">Consulting Services</option>
                                <option value="repair">Repair & Maintenance</option>
                                <option value="landscaping">Landscaping & Gardening</option>
                                <option value="cleaning">Cleaning Services</option>
                                <option value="other">Other (Specify)</option>
                            </select>
                            <div id="other-industry-input" class="mt-2 hidden">
                                <input type="text" id="custom-industry" 
                                       class="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                                       placeholder="Please specify your industry...">
                            </div>
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
        
        function toggleOtherIndustry() {
            const industrySelect = document.getElementById('business-industry');
            const otherInput = document.getElementById('other-industry-input');
            const customIndustry = document.getElementById('custom-industry');
            
            if (industrySelect.value === 'other') {
                otherInput.classList.remove('hidden');
                customIndustry.setAttribute('required', 'true');
            } else {
                otherInput.classList.add('hidden');
                customIndustry.removeAttribute('required');
                customIndustry.value = '';
            }
        }
        
        document.getElementById('business-signup-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Get industry value - use custom if 'other' is selected
            const industrySelect = document.getElementById('business-industry');
            const customIndustry = document.getElementById('custom-industry');
            const industryValue = industrySelect.value === 'other' ? customIndustry.value : industrySelect.value;
            
            const formData = {
                plan: selectedPlan,
                business_name: document.getElementById('business-name').value,
                industry: industryValue,
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
                    alert('🎉 Business Account Created!\\n\\nWelcome to Smartthinkerz!\\nBusiness ID: ' + result.business_id + '\\n\\nCheck your email for setup instructions.');
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
    <title>Smartthinkerz - Intelligent Business Solutions</title>
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
            <h1 class="text-4xl font-bold text-gray-800 mb-4">Smartthinkerz</h1>
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
            <p>&copy; 2024 Smartthinkerz Platform | Powered by Vercel + Supabase</p>
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

    // Create Quote page
    if (path === '/create-quote') {
      const businessId = url.searchParams.get('business') || 'demo_business_123';
      
      const html = '<!DOCTYPE html>' +
        '<html><head>' +
        '<meta charset="UTF-8">' +
        '<title>Create Quote - Smartthinkerz</title>' +
        '<script src="https://cdn.tailwindcss.com"></script>' +
        '</head><body class="bg-gray-100 min-h-screen">' +
        '<div class="max-w-4xl mx-auto py-8 px-4">' +
        '<div class="bg-white rounded-lg shadow-md p-6 mb-6">' +
        '<div class="flex items-center justify-between">' +
        '<div><h1 class="text-2xl font-bold text-gray-800">Create New Quote</h1>' +
        '<p class="text-gray-600">Generate quotes for your customers</p></div>' +
        '<a href="/dashboard?business=' + businessId + '" class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">' +
        'Back to Dashboard</a></div></div>' +
        '<div class="grid lg:grid-cols-2 gap-6">' +
        '<div class="bg-white rounded-lg shadow-md p-6">' +
        '<h2 class="text-xl font-semibold mb-4">Customer Information</h2>' +
        '<div class="space-y-4">' +
        '<input type="text" id="customer-name" placeholder="Customer Name *" required class="w-full p-3 border border-gray-300 rounded-md">' +
        '<input type="email" id="customer-email" placeholder="Customer Email" class="w-full p-3 border border-gray-300 rounded-md">' +
        '<input type="tel" id="customer-phone" placeholder="Phone Number *" required class="w-full p-3 border border-gray-300 rounded-md">' +
        '<select id="service-type" required class="w-full p-3 border border-gray-300 rounded-md">' +
        '<option value="">Select Service Type *</option>' +
        '<option value="construction">Construction</option>' +
        '<option value="renovation">Renovation</option>' +
        '<option value="repair">Repair Work</option>' +
        '<option value="maintenance">Maintenance</option>' +
        '<option value="plumbing">Plumbing</option>' +
        '<option value="electrical">Electrical</option>' +
        '<option value="painting">Painting</option>' +
        '</select>' +
        '<textarea id="project-description" rows="3" placeholder="Project Description *" required class="w-full p-3 border border-gray-300 rounded-md"></textarea>' +
        '<div class="grid md:grid-cols-2 gap-4">' +
        '<input type="number" id="estimated-hours" placeholder="Estimated Hours *" min="0.5" step="0.5" required class="w-full p-3 border border-gray-300 rounded-md">' +
        '<input type="number" id="material-costs" placeholder="Material Costs (OMR)" min="0" step="0.01" class="w-full p-3 border border-gray-300 rounded-md">' +
        '</div></div></div>' +
        '<div class="space-y-6">' +
        '<div class="bg-white rounded-lg shadow-md p-6">' +
        '<h2 class="text-xl font-semibold mb-4">Quote Preview</h2>' +
        '<div id="quote-preview" class="text-gray-500">Fill in the form to see quote calculation...</div>' +
        '</div>' +
        '<div class="bg-white rounded-lg shadow-md p-6">' +
        '<h2 class="text-xl font-semibold mb-4">Actions</h2>' +
        '<div class="space-y-3">' +
        '<button type="button" onclick="generateQuote()" class="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700">Generate Final Quote</button>' +
        '<button type="button" onclick="sendWhatsApp()" id="whatsapp-btn" disabled class="w-full bg-green-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-600 disabled:bg-gray-400">Send via WhatsApp</button>' +
        '<button type="button" onclick="emailQuote()" id="email-btn" disabled class="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400">Email Quote</button>' +
        '</div></div></div></div></div>' +
        '<script>' +
        'let currentQuote = null;' +
        'const hourlyRate = 75;' +
        'function generateQuote() {' +
        'const name = document.getElementById("customer-name").value;' +
        'const phone = document.getElementById("customer-phone").value;' +
        'const service = document.getElementById("service-type").value;' +
        'const description = document.getElementById("project-description").value;' +
        'const hours = parseFloat(document.getElementById("estimated-hours").value) || 0;' +
        'const materials = parseFloat(document.getElementById("material-costs").value) || 0;' +
        'if (!name || !phone || !service || !description || hours <= 0) {' +
        'alert("Please fill in all required fields (*)");' +
        'return;' +
        '}' +
        'const laborCost = hours * hourlyRate;' +
        'const subtotal = laborCost + materials;' +
        'const vat = subtotal * 0.05;' +
        'const total = subtotal + vat;' +
        'var html = "<div class=\\"bg-gray-50 rounded-lg p-4\\">";' +
        'html += "<div class=\\"flex justify-between mb-2\\"><span>Labor (" + hours + " hrs × " + hourlyRate + " OMR):</span><span class=\\"font-medium\\">" + laborCost.toFixed(2) + " OMR</span></div>";' +
        'html += "<div class=\\"flex justify-between mb-2\\"><span>Materials:</span><span class=\\"font-medium\\">" + materials.toFixed(2) + " OMR</span></div>";' +
        'html += "<div class=\\"flex justify-between mb-2\\"><span>VAT (5%):</span><span class=\\"font-medium\\">" + vat.toFixed(2) + " OMR</span></div>";' +
        'html += "<hr class=\\"my-2\\">";' +
        'html += "<div class=\\"flex justify-between text-lg font-bold text-green-600\\"><span>Total:</span><span>" + total.toFixed(2) + " OMR</span></div>";' +
        'html += "</div>";' +
        'document.getElementById("quote-preview").innerHTML = html;' +
        'currentQuote = {customer: {name: name, phone: phone}, service: service, description: description, total: total, id: "Q-" + Date.now()};' +
        'document.getElementById("whatsapp-btn").disabled = false;' +
        'document.getElementById("email-btn").disabled = false;' +
        'alert("Quote Generated Successfully!\\nQuote ID: " + currentQuote.id + "\\nTotal: " + total.toFixed(2) + " OMR");' +
        '}' +
        'function sendWhatsApp() {' +
        'if (!currentQuote) { alert("Please generate a quote first"); return; }' +
        'const phone = currentQuote.customer.phone.replace(/[^0-9]/g, "");' +
        'const message = "Hi " + currentQuote.customer.name + "! Your quote: " + currentQuote.total.toFixed(2) + " OMR. Quote ID: " + currentQuote.id;' +
        'window.open("https://wa.me/" + phone + "?text=" + encodeURIComponent(message));' +
        '}' +
        'function emailQuote() {' +
        'if (!currentQuote) { alert("Please generate a quote first"); return; }' +
        'alert("Email feature: Quote " + currentQuote.id + " for " + currentQuote.total.toFixed(2) + " OMR");' +
        '}' +
        '</script>' +
        '</body></html>';
      
      return sendResponse(200, html, 'text/html');
    }

    // WhatsApp Setup page
    if (path === '/whatsapp-setup') {
      const businessId = url.searchParams.get('business') || 'demo_business_123';
      const whatsappSetupHtml = `
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-bold text-gray-800">Create New Quote</h1>
                    <p class="text-gray-600">Generate quotes for your customers</p>
                </div>
                <a href="/dashboard?business=${businessId}" class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                    <i class="fas fa-arrow-left mr-2"></i>Back to Dashboard
                </a>
            </div>
        </div>
        
        <!-- Quote Generation Form -->
        <div class="grid lg:grid-cols-2 gap-6">
            <!-- Left Column - Customer & Project Info -->
            <div class="bg-white rounded-lg shadow-md p-6">
                <h2 class="text-xl font-semibold mb-4">Customer Information</h2>
                <form id="quote-form" class="space-y-4">
                    <div class="grid md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
                            <input type="text" id="customer-name" required 
                                   class="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                                   placeholder="Enter customer name">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Customer Email</label>
                            <input type="email" id="customer-email" 
                                   class="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                                   placeholder="customer@example.com">
                        </div>
                    </div>
                    
                    <div class="grid md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                            <input type="tel" id="customer-phone" required
                                   class="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                                   placeholder="+968 90000000">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Service Type *</label>
                            <select id="service-type" required class="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500">
                                <option value="">Select service...</option>
                                <option value="construction">Construction</option>
                                <option value="renovation">Renovation</option>
                                <option value="repair">Repair Work</option>
                                <option value="maintenance">Maintenance</option>
                                <option value="plumbing">Plumbing</option>
                                <option value="electrical">Electrical</option>
                                <option value="painting">Painting</option>
                                <option value="landscaping">Landscaping</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Project Description *</label>
                        <textarea id="project-description" rows="3" required
                                  class="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                                  placeholder="Describe the work needed..."></textarea>
                    </div>

                    <div class="grid md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Estimated Hours *</label>
                            <input type="number" id="estimated-hours" min="0.5" max="500" step="0.5" required
                                   class="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                                   placeholder="8">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Material Costs (OMR)</label>
                            <input type="number" id="material-costs" min="0" step="0.01"
                                   class="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                                   placeholder="200">
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Complexity Level</label>
                        <select id="complexity" class="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500">
                            <option value="1">Simple (Standard pricing)</option>
                            <option value="1.3">Moderate (+30%)</option>
                            <option value="1.6">Complex (+60%)</option>
                        </select>
                    </div>
                </form>
            </div>

            <!-- Right Column - Quote Preview & Actions -->
            <div class="space-y-6">
                <!-- Quote Preview -->
                <div class="bg-white rounded-lg shadow-md p-6">
                    <h2 class="text-xl font-semibold mb-4">Quote Preview</h2>
                    <div id="quote-preview" class="space-y-3">
                        <div class="text-gray-500">Fill in the form to see quote calculation...</div>
                    </div>
                </div>
                
                <!-- Actions -->
                <div class="bg-white rounded-lg shadow-md p-6">
                    <h2 class="text-xl font-semibold mb-4">Actions</h2>
                    <div class="space-y-3">
                        <button type="button" onclick="generateFinalQuote()" 
                                class="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700">
                            <i class="fas fa-file-alt mr-2"></i>Generate Final Quote
                        </button>
                        
                        <button type="button" onclick="sendViaWhatsApp()" id="whatsapp-btn" disabled
                                class="w-full bg-green-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed">
                            <i class="fab fa-whatsapp mr-2"></i>Send via WhatsApp
                        </button>
                        
                        <button type="button" onclick="emailQuote()" id="email-btn" disabled
                                class="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
                            <i class="fas fa-envelope mr-2"></i>Email Quote
                        </button>
                    </div>
                </div>
                
                <!-- Recent Quotes -->
                <div class="bg-white rounded-lg shadow-md p-6">
                    <h2 class="text-xl font-semibold mb-4">Recent Quotes</h2>
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between p-2 bg-gray-50 rounded">
                            <span>Kitchen renovation - Sarah J.</span>
                            <span class="font-medium text-green-600">1,250 OMR</span>
                        </div>
                        <div class="flex justify-between p-2 bg-gray-50 rounded">
                            <span>Bathroom repair - Mike C.</span>
                            <span class="font-medium text-green-600">425 OMR</span>
                        </div>
                        <div class="flex justify-between p-2 bg-gray-50 rounded">
                            <span>Plumbing work - Lisa R.</span>
                            <span class="font-medium text-green-600">185 OMR</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        let currentQuote = null;
        const hourlyRate = 75; // Default rate - should come from business settings
        
        function calculateQuote() {
            const hours = parseFloat(document.getElementById('estimated-hours').value) || 0;
            const materials = parseFloat(document.getElementById('material-costs').value) || 0;
            const complexity = parseFloat(document.getElementById('complexity').value) || 1;
            
            if (hours <= 0) {
                document.getElementById('quote-preview').innerHTML = '<div class="text-gray-500">Enter estimated hours to calculate quote...</div>';
                return;
            }
            
            const laborCost = hours * hourlyRate * complexity;
            const subtotal = laborCost + materials;
            const vat = subtotal * 0.05; // 5% VAT
            const total = subtotal + vat;
            
            document.getElementById('quote-preview').innerHTML = 
                '<div class="bg-gray-50 rounded-lg p-4">' +
                    '<div class="flex justify-between mb-2">' +
                        '<span>Labor (' + hours + ' hrs × ' + hourlyRate + ' OMR × ' + complexity + 'x):</span>' +
                        '<span class="font-medium">' + laborCost.toFixed(2) + ' OMR</span>' +
                    '</div>' +
                    '<div class="flex justify-between mb-2">' +
                        '<span>Materials:</span>' +
                        '<span class="font-medium">' + materials.toFixed(2) + ' OMR</span>' +
                    '</div>' +
                    '<div class="flex justify-between mb-2">' +
                        '<span>VAT (5%):</span>' +
                        '<span class="font-medium">' + vat.toFixed(2) + ' OMR</span>' +
                    '</div>' +
                    '<hr class="my-2">' +
                    '<div class="flex justify-between text-lg font-bold text-green-600">' +
                        '<span>Total:</span>' +
                        '<span>' + total.toFixed(2) + ' OMR</span>' +
                    '</div>' +
                '</div>' +
                '<div class="mt-3 text-xs text-gray-500">' +
                    '<p>• Quote valid for 30 days</p>' +
                    '<p>• Payment terms: 50% upfront, 50% on completion</p>' +
                    '<p>• Includes materials, labor, and cleanup</p>' +
                '</div>';
            
            // Store quote data
            currentQuote = {
                customer: {
                    name: document.getElementById('customer-name').value,
                    email: document.getElementById('customer-email').value,
                    phone: document.getElementById('customer-phone').value
                },
                service: document.getElementById('service-type').value,
                description: document.getElementById('project-description').value,
                hours: hours,
                hourlyRate: hourlyRate,
                complexity: complexity,
                materials: materials,
                laborCost: laborCost,
                subtotal: subtotal,
                vat: vat,
                total: total,
                quoteId: 'Q-' + Date.now()
            };
        }
        
        function generateFinalQuote() {
            if (!validateForm()) return;
            
            calculateQuote();
            if (!currentQuote) return;
            
            // Enable action buttons
            document.getElementById('whatsapp-btn').disabled = false;
            document.getElementById('email-btn').disabled = false;
            
            alert('Quote Generated Successfully!\n\nQuote ID: ' + currentQuote.quoteId + '\nCustomer: ' + currentQuote.customer.name + '\nTotal: ' + currentQuote.total.toFixed(2) + ' OMR\n\nYou can now send this quote via WhatsApp or email.');
        }
        
        function sendViaWhatsApp() {
            if (!currentQuote) {
                alert('Please generate a quote first');
                return;
            }
            
            const phone = currentQuote.customer.phone.replace(/[^0-9]/g, '');
            const message = 'Hi ' + currentQuote.customer.name + '!\n\n📝 Your Quote: ' + currentQuote.quoteId + '\nService: ' + currentQuote.service + '\nDescription: ' + currentQuote.description + '\n\n💰 Total Cost: ' + currentQuote.total.toFixed(2) + ' OMR\n\nBreakdown:\n- Labor: ' + currentQuote.laborCost.toFixed(2) + ' OMR\n- Materials: ' + currentQuote.materials.toFixed(2) + ' OMR\n- VAT: ' + currentQuote.vat.toFixed(2) + ' OMR\n\n✅ Valid for 30 days\n📞 Contact us to proceed!\n\nThank you for choosing us!';
            
            const whatsappUrl = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(message);
            window.open(whatsappUrl, '_blank');
        }
        
        function emailQuote() {
            if (!currentQuote) {
                alert('Please generate a quote first');
                return;
            }
            
            const email = currentQuote.customer.email;
            if (!email) {
                alert('Customer email is required to send quote via email');
                return;
            }
            
            const subject = 'Quote ' + currentQuote.quoteId + ' - ' + currentQuote.service;
            const body = 'Dear ' + currentQuote.customer.name + ',\n\nThank you for your inquiry. Please find your quote details below:\n\nQuote ID: ' + currentQuote.quoteId + '\nService: ' + currentQuote.service + '\nDescription: ' + currentQuote.description + '\n\nTotal Cost: ' + currentQuote.total.toFixed(2) + ' OMR\n\nBreakdown:\n- Labor: ' + currentQuote.laborCost.toFixed(2) + ' OMR\n- Materials: ' + currentQuote.materials.toFixed(2) + ' OMR\n- VAT (5%): ' + currentQuote.vat.toFixed(2) + ' OMR\n\nThis quote is valid for 30 days.\nPayment terms: 50% upfront, 50% on completion.\n\nPlease contact us to proceed with the work.\n\nBest regards,\nYour Service Team';
            
            const mailtoUrl = 'mailto:' + email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
            window.location.href = mailtoUrl;
        }
        
        function validateForm() {
            const required = ['customer-name', 'customer-phone', 'service-type', 'project-description', 'estimated-hours'];
            
            for (let field of required) {
                if (!document.getElementById(field).value) {
                    alert('Please fill in all required fields (*)');
                    document.getElementById(field).focus();
                    return false;
                }
            }
            
            return true;
        }
        
        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
            // Add input listeners for real-time calculation
            ['estimated-hours', 'material-costs', 'complexity'].forEach(id => {
                document.getElementById(id).addEventListener('input', calculateQuote);
                document.getElementById(id).addEventListener('change', calculateQuote);
            });
        });
    </script>
</body>
</html>`;
      
      return sendResponse(200, createQuoteHtml, 'text/html');
    }

    // WhatsApp Setup page
    if (path === '/whatsapp-setup') {
      const businessId = url.searchParams.get('business') || 'demo_business_123';
      const whatsappSetupHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp Setup - Smartthinkerz</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-100 min-h-screen">
    <div class="max-w-4xl mx-auto py-8 px-4">
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-bold text-gray-800">
                        <i class="fab fa-whatsapp text-green-500 mr-2"></i>
                        WhatsApp Business API Setup
                    </h1>
                    <p class="text-gray-600">Connect your WhatsApp Business number for automated quote delivery</p>
                </div>
                <a href="/dashboard?business=${businessId}" class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                    <i class="fas fa-arrow-left mr-2"></i>Back to Dashboard
                </a>
            </div>
        </div>
        
        <div class="bg-white rounded-lg shadow-md p-6">
            <div class="text-center py-12">
                <i class="fab fa-whatsapp text-6xl text-green-500 mb-4"></i>
                <h2 class="text-2xl font-bold text-gray-800 mb-4">WhatsApp Business Integration</h2>
                <p class="text-gray-600 mb-6">Complete WhatsApp Business API setup coming in Phase 2!</p>
                <div class="space-y-3">
                    <p class="text-sm text-gray-500">Features to include:</p>
                    <ul class="text-left max-w-md mx-auto text-sm text-gray-600">
                        <li>• QR code pairing with WhatsApp Business</li>
                        <li>• Automated quote message templates</li>
                        <li>• Customer response handling</li>
                        <li>• Message delivery status tracking</li>
                        <li>• Webhook integration setup</li>
                    </ul>
                </div>
                <button onclick="alert('WhatsApp integration coming in Phase 2!')" class="mt-6 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700">
                    <i class="fab fa-whatsapp mr-2"></i>Connect WhatsApp (Demo)
                </button>
            </div>
        </div>
    </div>
</body>
</html>`;
      
      return sendResponse(200, whatsappSetupHtml, 'text/html');
    }

    // Pricing Configuration page
    if (path === '/pricing-config') {
      const businessId = url.searchParams.get('business') || 'demo_business_123';
      const pricingConfigHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pricing Configuration - Smartthinkerz</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-100 min-h-screen">
    <div class="max-w-4xl mx-auto py-8 px-4">
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-bold text-gray-800">
                        <i class="fas fa-cogs text-purple-500 mr-2"></i>
                        Pricing Configuration
                    </h1>
                    <p class="text-gray-600">Set up your service rates, material markups, and pricing rules</p>
                </div>
                <a href="/dashboard?business=${businessId}" class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                    <i class="fas fa-arrow-left mr-2"></i>Back to Dashboard
                </a>
            </div>
        </div>
        
        <div class="bg-white rounded-lg shadow-md p-6">
            <div class="text-center py-12">
                <i class="fas fa-cogs text-6xl text-purple-500 mb-4"></i>
                <h2 class="text-2xl font-bold text-gray-800 mb-4">Pricing Rules Configuration</h2>
                <p class="text-gray-600 mb-6">Advanced pricing configuration interface coming soon!</p>
                <div class="space-y-3">
                    <p class="text-sm text-gray-500">Features to include:</p>
                    <ul class="text-left max-w-md mx-auto text-sm text-gray-600">
                        <li>• Service-specific hourly rates</li>
                        <li>• Material markup percentages</li>
                        <li>• Complexity multipliers</li>
                        <li>• Minimum quote amounts</li>
                        <li>• Tax and fee configuration</li>
                    </ul>
                </div>
                <button onclick="alert('Pricing configuration interface coming soon!')" class="mt-6 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700">
                    <i class="fas fa-cogs mr-2"></i>Configure Pricing (Demo)
                </button>
            </div>
        </div>
    </div>
</body>
</html>`;
      
      return sendResponse(200, pricingConfigHtml, 'text/html');
    }

    // Advanced Analytics page
    if (path === '/analytics') {
      const businessId = url.searchParams.get('business') || 'demo_business_123';
      const analyticsHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Advanced Analytics - Smartthinkerz</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-100 min-h-screen">
    <div class="max-w-4xl mx-auto py-8 px-4">
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-bold text-gray-800">
                        <i class="fas fa-chart-line text-orange-500 mr-2"></i>
                        Advanced Analytics
                    </h1>
                    <p class="text-gray-600">Detailed insights into your quote performance and business metrics</p>
                </div>
                <a href="/dashboard?business=${businessId}" class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                    <i class="fas fa-arrow-left mr-2"></i>Back to Dashboard
                </a>
            </div>
        </div>
        
        <div class="bg-white rounded-lg shadow-md p-6">
            <div class="text-center py-12">
                <i class="fas fa-chart-line text-6xl text-orange-500 mb-4"></i>
                <h2 class="text-2xl font-bold text-gray-800 mb-4">Business Analytics Dashboard</h2>
                <p class="text-gray-600 mb-6">Comprehensive analytics dashboard with charts and insights coming soon!</p>
                <div class="space-y-3">
                    <p class="text-sm text-gray-500">Features to include:</p>
                    <ul class="text-left max-w-md mx-auto text-sm text-gray-600">
                        <li>• Quote conversion funnel analysis</li>
                        <li>• Revenue trends and forecasting</li>
                        <li>• Peak request time analytics</li>
                        <li>• Popular services breakdown</li>
                        <li>• Customer behavior insights</li>
                    </ul>
                </div>
                <button onclick="alert('Advanced analytics coming soon!')" class="mt-6 bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700">
                    <i class="fas fa-chart-line mr-2"></i>View Analytics (Demo)
                </button>
            </div>
        </div>
    </div>
</body>
</html>`;
      
      return sendResponse(200, analyticsHtml, 'text/html');
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
        '/api/analytics',
        '/dashboard',
        '/create-quote',
        '/whatsapp-setup',
        '/pricing-config',
        '/analytics'
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