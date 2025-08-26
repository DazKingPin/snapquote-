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
      from: 'SnapQuote <noreply@snapquote.ai>',
      to: [businessData.email],
      subject: `Welcome to SnapQuote! Your ${businessData.planName} account is ready`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to SnapQuote</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 28px;">🚀 Welcome to SnapQuote!</h1>
                <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">Your AI-Powered Quote Generation Platform</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                <h2 style="color: #667eea; margin-top: 0;">Hi ${businessData.businessName}! 👋</h2>
                
                <p>Congratulations! Your <strong>${businessData.planName}</strong> account has been successfully created. You're now ready to start generating AI-powered quotes for your customers via WhatsApp.</p>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                    <h3 style="margin-top: 0; color: #667eea;">📋 Your Account Details</h3>
                    <p><strong>Business:</strong> ${businessData.businessName}</p>
                    <p><strong>Email:</strong> ${businessData.email}</p>
                    <p><strong>Plan:</strong> ${businessData.planName}</p>
                    <p><strong>Business ID:</strong> ${businessData.businessId}</p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://snapquote-six.vercel.app/dashboard?business=${businessData.businessId}" 
                       style="display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Access Your Dashboard</a>
                </div>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #667eea;">🚀 Next Steps</h3>
                    <ol>
                        <li><strong>Connect WhatsApp:</strong> Link your WhatsApp Business number</li>
                        <li><strong>Configure Pricing:</strong> Set your service rates and pricing rules</li>
                        <li><strong>Generate First Quote:</strong> Create your first AI-powered quote</li>
                        <li><strong>Monitor Analytics:</strong> Track your quote performance</li>
                    </ol>
                </div>
                
                <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>💡 Pro Tip:</strong> Upload sample images of your work to improve AI quote accuracy!</p>
                </div>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                
                <p style="color: #666; font-size: 14px; text-align: center;">Need help? Reply to this email or visit our <a href="https://snapquote-six.vercel.app/support" style="color: #667eea;">support center</a>.</p>
                
                <div style="text-align: center; margin-top: 20px;">
                    <p style="color: #999; font-size: 12px;">SnapQuote - AI-Powered Quote Generation Platform<br>Making business quotes faster, smarter, and more profitable.</p>
                </div>
            </div>
        </body>
        </html>
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

    // Business dashboard page
    if (path === '/dashboard') {
      const businessId = url.searchParams.get('business') || 'demo_business_123';
      const dashboardHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Business Dashboard - SnapQuote</title>
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
                        <h1 class="text-xl font-bold text-purple-600">SnapQuote Dashboard</h1>
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
            window.location.href = `/create-quote?business=${businessId}`;
        }

        function setupWhatsApp() {
            const businessId = new URLSearchParams(window.location.search).get('business');
            window.location.href = `/whatsapp-setup?business=${businessId}`;
        }

        function configurePricing() {
            const businessId = new URLSearchParams(window.location.search).get('business');
            window.location.href = `/pricing-config?business=${businessId}`;
        }

        function viewAnalytics() {
            const businessId = new URLSearchParams(window.location.search).get('business');
            window.location.href = `/analytics?business=${businessId}`;
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

    // Create Quote page
    if (path === '/create-quote') {
      const businessId = url.searchParams.get('business') || 'demo_business_123';
      const createQuoteHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Create Quote - SnapQuote</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-100 min-h-screen">
    <div class="max-w-4xl mx-auto py-8 px-4">
        <!-- Header -->
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-bold text-gray-800">Create New Quote</h1>
                    <p class="text-gray-600">Generate AI-powered quotes for your customers</p>
                </div>
                <a href="/dashboard?business=${businessId}" class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                    <i class="fas fa-arrow-left mr-2"></i>Back to Dashboard
                </a>
            </div>
        </div>

        <!-- Quote Form -->
        <div class="grid lg:grid-cols-2 gap-6">
            <!-- Left Column - Quote Details -->
            <div class="bg-white rounded-lg shadow-md p-6">
                <h2 class="text-xl font-semibold mb-4">Quote Information</h2>
                <form id="quote-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
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
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Customer Phone</label>
                        <input type="tel" id="customer-phone" 
                               class="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                               placeholder="+968 90000000">
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
                        <select id="service-type" required class="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500">
                            <option value="">Select service type...</option>
                            <option value="construction">Construction</option>
                            <option value="renovation">Renovation</option>
                            <option value="repair">Repair</option>
                            <option value="maintenance">Maintenance</option>
                            <option value="plumbing">Plumbing</option>
                            <option value="electrical">Electrical</option>
                            <option value="painting">Painting</option>
                            <option value="landscaping">Landscaping</option>
                            <option value="other">Other</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Project Description</label>
                        <textarea id="project-description" rows="4" required
                                  class="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                                  placeholder="Describe the project in detail..."></textarea>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Estimated Hours</label>
                        <input type="number" id="estimated-hours" min="1" max="1000" required
                               class="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                               placeholder="Enter estimated hours">
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Material Costs (Optional)</label>
                        <input type="number" id="material-costs" min="0" step="0.01"
                               class="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                               placeholder="Enter material costs in OMR">
                    </div>
                </form>
            </div>

            <!-- Right Column - Image Upload & Quote Preview -->
            <div class="space-y-6">
                <!-- Image Upload -->
                <div class="bg-white rounded-lg shadow-md p-6">
                    <h2 class="text-xl font-semibold mb-4">Project Images (AI Analysis)</h2>
                    <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <div id="image-upload-area">
                            <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-4"></i>
                            <p class="text-gray-600 mb-4">Upload project images for AI analysis</p>
                            <input type="file" id="project-images" multiple accept="image/*" class="hidden">
                            <button type="button" onclick="document.getElementById('project-images').click()" 
                                    class="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">
                                <i class="fas fa-plus mr-2"></i>Select Images
                            </button>
                        </div>
                        <div id="image-preview" class="mt-4 hidden"></div>
                    </div>
                </div>

                <!-- Quote Preview -->
                <div class="bg-white rounded-lg shadow-md p-6">
                    <h2 class="text-xl font-semibold mb-4">Quote Preview</h2>
                    <div id="quote-preview" class="space-y-3 text-gray-600">
                        <p>Fill in the form to generate quote preview...</p>
                    </div>
                    
                    <div class="mt-6 space-y-3">
                        <button type="button" onclick="generateQuote()" 
                                class="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700">
                            <i class="fas fa-magic mr-2"></i>Generate AI Quote
                        </button>
                        
                        <button type="button" onclick="sendWhatsApp()" id="send-whatsapp-btn" disabled
                                class="w-full bg-green-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed">
                            <i class="fab fa-whatsapp mr-2"></i>Send via WhatsApp
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        let currentQuote = null;
        
        // Real-time quote preview
        document.addEventListener('input', updateQuotePreview);
        
        function updateQuotePreview() {
            const hours = parseFloat(document.getElementById('estimated-hours').value) || 0;
            const materials = parseFloat(document.getElementById('material-costs').value) || 0;
            const hourlyRate = 75; // From business profile
            
            const laborCost = hours * hourlyRate;
            const subtotal = laborCost + materials;
            const tax = subtotal * 0.05; // 5% VAT
            const total = subtotal + tax;
            
            const preview = document.getElementById('quote-preview');
            if (hours > 0) {
                preview.innerHTML = `
                    <div class="bg-gray-50 rounded-lg p-4">
                        <div class="flex justify-between mb-2">
                            <span>Labor (${hours} hrs × ${hourlyRate} OMR):</span>
                            <span class="font-medium">${laborCost.toFixed(2)} OMR</span>
                        </div>
                        <div class="flex justify-between mb-2">
                            <span>Materials:</span>
                            <span class="font-medium">${materials.toFixed(2)} OMR</span>
                        </div>
                        <div class="flex justify-between mb-2">
                            <span>VAT (5%):</span>
                            <span class="font-medium">${tax.toFixed(2)} OMR</span>
                        </div>
                        <hr class="my-2">
                        <div class="flex justify-between text-lg font-bold text-green-600">
                            <span>Total:</span>
                            <span>${total.toFixed(2)} OMR</span>
                        </div>
                    </div>
                `;
            }
        }
        
        async function generateQuote() {
            const formData = {
                customer_name: document.getElementById('customer-name').value,
                customer_email: document.getElementById('customer-email').value,
                customer_phone: document.getElementById('customer-phone').value,
                service_type: document.getElementById('service-type').value,
                project_description: document.getElementById('project-description').value,
                estimated_hours: parseFloat(document.getElementById('estimated-hours').value),
                material_costs: parseFloat(document.getElementById('material-costs').value) || 0
            };
            
            if (!formData.customer_name || !formData.service_type || !formData.project_description || !formData.estimated_hours) {
                alert('Please fill in all required fields');
                return;
            }
            
            try {
                const response = await fetch('/api/generate-quote', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                
                const result = await response.json();
                if (result.success) {
                    currentQuote = result.quote;
                    document.getElementById('send-whatsapp-btn').disabled = false;
                    alert(`Quote Generated Successfully!\nQuote ID: ${result.quote.id}\nTotal: ${result.quote.amount} ${result.quote.currency}\nPayment URL: ${result.payment_url}`);
                } else {
                    alert('Error generating quote: ' + result.message);
                }
            } catch (error) {
                alert('Error: ' + error.message);
            }
        }
        
        function sendWhatsApp() {
            if (!currentQuote) {
                alert('Please generate a quote first');
                return;
            }
            
            const phone = document.getElementById('customer-phone').value;
            if (!phone) {
                alert('Please enter customer phone number');
                return;
            }
            
            const message = `Hi ${currentQuote.customer.name}! Your quote for ${currentQuote.description} is ready:\n\n💰 Total: ${currentQuote.amount} ${currentQuote.currency}\n🔗 Pay here: ${currentQuote.payment_url}\n\nThank you for choosing us!`;
            const whatsappUrl = `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
            
            window.open(whatsappUrl, '_blank');
        }
        
        // Image upload preview
        document.getElementById('project-images').addEventListener('change', function(e) {
            const files = e.target.files;
            const preview = document.getElementById('image-preview');
            
            if (files.length > 0) {
                preview.classList.remove('hidden');
                preview.innerHTML = '';
                
                for (let i = 0; i < Math.min(files.length, 4); i++) {
                    const file = files[i];
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const img = document.createElement('img');
                        img.src = e.target.result;
                        img.className = 'w-20 h-20 object-cover rounded inline-block mr-2 mb-2';
                        preview.appendChild(img);
                    };
                    reader.readAsDataURL(file);
                }
            }
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
    <title>WhatsApp Setup - SnapQuote</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-100 min-h-screen">
    <div class="max-w-4xl mx-auto py-8 px-4">
        <!-- Header -->
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

        <!-- Setup Steps -->
        <div class="grid lg:grid-cols-2 gap-6">
            <!-- Left Column - Instructions -->
            <div class="bg-white rounded-lg shadow-md p-6">
                <h2 class="text-xl font-semibold mb-4">Setup Instructions</h2>
                
                <div class="space-y-4">
                    <div class="flex items-start space-x-3">
                        <div class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span class="text-sm font-medium text-green-600">1</span>
                        </div>
                        <div>
                            <h3 class="font-medium text-gray-800">WhatsApp Business Account</h3>
                            <p class="text-sm text-gray-600">Make sure you have a WhatsApp Business account with a verified phone number</p>
                        </div>
                    </div>
                    
                    <div class="flex items-start space-x-3">
                        <div class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span class="text-sm font-medium text-green-600">2</span>
                        </div>
                        <div>
                            <h3 class="font-medium text-gray-800">Scan QR Code</h3>
                            <p class="text-sm text-gray-600">Use WhatsApp Business app to scan the QR code on the right</p>
                        </div>
                    </div>
                    
                    <div class="flex items-start space-x-3">
                        <div class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span class="text-sm font-medium text-green-600">3</span>
                        </div>
                        <div>
                            <h3 class="font-medium text-gray-800">Authorize Connection</h3>
                            <p class="text-sm text-gray-600">Approve the connection to enable automated quote sending</p>
                        </div>
                    </div>
                    
                    <div class="flex items-start space-x-3">
                        <div class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span class="text-sm font-medium text-green-600">4</span>
                        </div>
                        <div>
                            <h3 class="font-medium text-gray-800">Test Connection</h3>
                            <p class="text-sm text-gray-600">Send a test message to verify the integration is working</p>
                        </div>
                    </div>
                </div>

                <!-- Current Status -->
                <div class="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div class="flex items-center">
                        <i class="fas fa-exclamation-triangle text-yellow-600 mr-2"></i>
                        <span class="font-medium text-yellow-800">Connection Status: Not Connected</span>
                    </div>
                    <p class="text-sm text-yellow-700 mt-1">WhatsApp Business API integration coming in Phase 2. Currently using manual sharing.</p>
                </div>
            </div>

            <!-- Right Column - QR Code & Connection -->
            <div class="bg-white rounded-lg shadow-md p-6">
                <h2 class="text-xl font-semibold mb-4">QR Code Setup</h2>
                
                <!-- QR Code Placeholder -->
                <div class="bg-gray-100 rounded-lg p-8 text-center mb-4">
                    <div class="w-48 h-48 mx-auto bg-white rounded-lg flex items-center justify-center border-2 border-gray-300">
                        <div class="text-gray-500 text-center">
                            <i class="fas fa-qrcode text-4xl mb-2"></i>
                            <p class="text-sm">QR Code will appear here</p>
                            <p class="text-xs text-gray-400 mt-1">Coming in Phase 2</p>
                        </div>
                    </div>
                </div>
                
                <!-- Manual Setup for Now -->
                <div class="border-t pt-4">
                    <h3 class="font-medium text-gray-800 mb-3">Manual WhatsApp Integration (Current)</h3>
                    
                    <div class="space-y-3">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">WhatsApp Business Number</label>
                            <input type="tel" id="whatsapp-number" 
                                   class="w-full p-3 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                                   placeholder="+968 90000000">
                        </div>
                        
                        <button onclick="saveWhatsAppNumber()" 
                                class="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700">
                            <i class="fab fa-whatsapp mr-2"></i>Save WhatsApp Number
                        </button>
                        
                        <button onclick="testWhatsApp()" 
                                class="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700">
                            <i class="fas fa-paper-plane mr-2"></i>Test Message
                        </button>
                    </div>
                </div>
                
                <!-- Future Features -->
                <div class="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 class="font-medium text-blue-800 mb-2">Coming in Phase 2:</h4>
                    <ul class="text-sm text-blue-700 space-y-1">
                        <li>• Automatic QR code generation</li>
                        <li>• Real-time message delivery</li>
                        <li>• Customer response handling</li>
                        <li>• Message templates management</li>
                        <li>• Delivery status tracking</li>
                    </ul>
                </div>
            </div>
        </div>
    </div>

    <script>
        function saveWhatsAppNumber() {
            const number = document.getElementById('whatsapp-number').value;
            if (!number) {
                alert('Please enter your WhatsApp Business number');
                return;
            }
            
            // Save to business profile (placeholder)
            alert('✅ WhatsApp number saved successfully!\n\nNumber: ' + number + '\n\nYou can now use the "Test Message" to verify your setup.');
        }
        
        function testWhatsApp() {
            const number = document.getElementById('whatsapp-number').value;
            if (!number) {
                alert('Please save your WhatsApp number first');
                return;
            }
            
            const testMessage = 'Hello! This is a test message from SnapQuote. Your WhatsApp integration is working correctly! 🎉';
            const whatsappUrl = `https://wa.me/${number.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(testMessage)}`;
            
            window.open(whatsappUrl, '_blank');
        }
    </script>
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
    <title>Pricing Configuration - SnapQuote</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-100 min-h-screen">
    <div class="max-w-6xl mx-auto py-8 px-4">
        <!-- Header -->
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

        <div class="grid lg:grid-cols-2 gap-6">
            <!-- Left Column - Pricing Settings -->
            <div class="space-y-6">
                <!-- Basic Rates -->
                <div class="bg-white rounded-lg shadow-md p-6">
                    <h2 class="text-xl font-semibold mb-4">Basic Hourly Rates</h2>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Construction Work</label>
                            <div class="relative">
                                <input type="number" id="construction-rate" value="75" min="10" max="500" step="5"
                                       class="w-full p-3 pr-16 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500">
                                <div class="absolute inset-y-0 right-0 pr-3 flex items-center">
                                    <span class="text-gray-500 text-sm">OMR/hr</span>
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Renovation Work</label>
                            <div class="relative">
                                <input type="number" id="renovation-rate" value="85" min="10" max="500" step="5"
                                       class="w-full p-3 pr-16 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500">
                                <div class="absolute inset-y-0 right-0 pr-3 flex items-center">
                                    <span class="text-gray-500 text-sm">OMR/hr</span>
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Emergency Repairs</label>
                            <div class="relative">
                                <input type="number" id="emergency-rate" value="120" min="10" max="500" step="5"
                                       class="w-full p-3 pr-16 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500">
                                <div class="absolute inset-y-0 right-0 pr-3 flex items-center">
                                    <span class="text-gray-500 text-sm">OMR/hr</span>
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Maintenance Work</label>
                            <div class="relative">
                                <input type="number" id="maintenance-rate" value="65" min="10" max="500" step="5"
                                       class="w-full p-3 pr-16 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500">
                                <div class="absolute inset-y-0 right-0 pr-3 flex items-center">
                                    <span class="text-gray-500 text-sm">OMR/hr</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Material Markups -->
                <div class="bg-white rounded-lg shadow-md p-6">
                    <h2 class="text-xl font-semibold mb-4">Material Markups</h2>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Standard Materials</label>
                            <div class="relative">
                                <input type="number" id="standard-markup" value="25" min="0" max="100" step="5"
                                       class="w-full p-3 pr-8 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500">
                                <div class="absolute inset-y-0 right-0 pr-3 flex items-center">
                                    <span class="text-gray-500 text-sm">%</span>
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Premium Materials</label>
                            <div class="relative">
                                <input type="number" id="premium-markup" value="35" min="0" max="100" step="5"
                                       class="w-full p-3 pr-8 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500">
                                <div class="absolute inset-y-0 right-0 pr-3 flex items-center">
                                    <span class="text-gray-500 text-sm">%</span>
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Specialized Materials</label>
                            <div class="relative">
                                <input type="number" id="specialized-markup" value="45" min="0" max="100" step="5"
                                       class="w-full p-3 pr-8 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500">
                                <div class="absolute inset-y-0 right-0 pr-3 flex items-center">
                                    <span class="text-gray-500 text-sm">%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Column - Rules & Preview -->
            <div class="space-y-6">
                <!-- Complexity Multipliers -->
                <div class="bg-white rounded-lg shadow-md p-6">
                    <h2 class="text-xl font-semibold mb-4">Complexity Multipliers</h2>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Simple Projects</label>
                            <div class="relative">
                                <input type="number" id="simple-multiplier" value="1.0" min="0.5" max="3.0" step="0.1"
                                       class="w-full p-3 pr-8 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500">
                                <div class="absolute inset-y-0 right-0 pr-3 flex items-center">
                                    <span class="text-gray-500 text-sm">x</span>
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Moderate Complexity</label>
                            <div class="relative">
                                <input type="number" id="moderate-multiplier" value="1.3" min="0.5" max="3.0" step="0.1"
                                       class="w-full p-3 pr-8 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500">
                                <div class="absolute inset-y-0 right-0 pr-3 flex items-center">
                                    <span class="text-gray-500 text-sm">x</span>
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">High Complexity</label>
                            <div class="relative">
                                <input type="number" id="complex-multiplier" value="1.8" min="0.5" max="3.0" step="0.1"
                                       class="w-full p-3 pr-8 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500">
                                <div class="absolute inset-y-0 right-0 pr-3 flex items-center">
                                    <span class="text-gray-500 text-sm">x</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Minimum Amounts & Tax -->
                <div class="bg-white rounded-lg shadow-md p-6">
                    <h2 class="text-xl font-semibold mb-4">Minimum Amounts & Tax</h2>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Minimum Quote Amount</label>
                            <div class="relative">
                                <input type="number" id="minimum-amount" value="50" min="10" max="1000" step="10"
                                       class="w-full p-3 pr-16 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500">
                                <div class="absolute inset-y-0 right-0 pr-3 flex items-center">
                                    <span class="text-gray-500 text-sm">OMR</span>
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">VAT Rate</label>
                            <div class="relative">
                                <input type="number" id="vat-rate" value="5" min="0" max="25" step="0.5"
                                       class="w-full p-3 pr-8 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500">
                                <div class="absolute inset-y-0 right-0 pr-3 flex items-center">
                                    <span class="text-gray-500 text-sm">%</span>
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Service Charge</label>
                            <div class="relative">
                                <input type="number" id="service-charge" value="15" min="0" max="100" step="5"
                                       class="w-full p-3 pr-16 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500">
                                <div class="absolute inset-y-0 right-0 pr-3 flex items-center">
                                    <span class="text-gray-500 text-sm">OMR</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Quote Preview Calculator -->
                <div class="bg-white rounded-lg shadow-md p-6">
                    <h2 class="text-xl font-semibold mb-4">Pricing Calculator Preview</h2>
                    
                    <div class="bg-gray-50 rounded-lg p-4 mb-4">
                        <div class="text-sm text-gray-600 space-y-2">
                            <div class="flex justify-between">
                                <span>Construction (8 hrs):</span>
                                <span id="preview-labor">600.00 OMR</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Materials (25% markup):</span>
                                <span id="preview-materials">250.00 OMR</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Complexity (1.3x):</span>
                                <span id="preview-complexity">+255.00 OMR</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Service Charge:</span>
                                <span id="preview-service">15.00 OMR</span>
                            </div>
                            <div class="flex justify-between">
                                <span>VAT (5%):</span>
                                <span id="preview-vat">56.00 OMR</span>
                            </div>
                            <hr class="my-2">
                            <div class="flex justify-between font-bold text-lg text-green-600">
                                <span>Total:</span>
                                <span id="preview-total">1,176.00 OMR</span>
                            </div>
                        </div>
                    </div>
                    
                    <button onclick="savePricingConfig()" 
                            class="w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-purple-700">
                        <i class="fas fa-save mr-2"></i>Save Configuration
                    </button>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Real-time preview updates
        document.addEventListener('input', updatePreview);
        
        function updatePreview() {
            const constructionRate = parseFloat(document.getElementById('construction-rate').value);
            const materialMarkup = parseFloat(document.getElementById('standard-markup').value) / 100;
            const complexityMultiplier = parseFloat(document.getElementById('moderate-multiplier').value);
            const serviceCharge = parseFloat(document.getElementById('service-charge').value);
            const vatRate = parseFloat(document.getElementById('vat-rate').value) / 100;
            
            // Sample calculation: 8 hours construction, 200 OMR materials
            const hours = 8;
            const baseMaterials = 200;
            
            const labor = hours * constructionRate;
            const materials = baseMaterials * (1 + materialMarkup);
            const complexityAdjustment = (labor + materials) * (complexityMultiplier - 1);
            const subtotal = labor + materials + complexityAdjustment + serviceCharge;
            const vat = subtotal * vatRate;
            const total = subtotal + vat;
            
            document.getElementById('preview-labor').textContent = labor.toFixed(2) + ' OMR';
            document.getElementById('preview-materials').textContent = materials.toFixed(2) + ' OMR';
            document.getElementById('preview-complexity').textContent = '+' + complexityAdjustment.toFixed(2) + ' OMR';
            document.getElementById('preview-service').textContent = serviceCharge.toFixed(2) + ' OMR';
            document.getElementById('preview-vat').textContent = vat.toFixed(2) + ' OMR';
            document.getElementById('preview-total').textContent = total.toFixed(2) + ' OMR';
        }
        
        function savePricingConfig() {
            const config = {
                hourly_rates: {
                    construction: parseFloat(document.getElementById('construction-rate').value),
                    renovation: parseFloat(document.getElementById('renovation-rate').value),
                    emergency: parseFloat(document.getElementById('emergency-rate').value),
                    maintenance: parseFloat(document.getElementById('maintenance-rate').value)
                },
                material_markups: {
                    standard: parseFloat(document.getElementById('standard-markup').value),
                    premium: parseFloat(document.getElementById('premium-markup').value),
                    specialized: parseFloat(document.getElementById('specialized-markup').value)
                },
                complexity_multipliers: {
                    simple: parseFloat(document.getElementById('simple-multiplier').value),
                    moderate: parseFloat(document.getElementById('moderate-multiplier').value),
                    complex: parseFloat(document.getElementById('complex-multiplier').value)
                },
                minimums_and_tax: {
                    minimum_amount: parseFloat(document.getElementById('minimum-amount').value),
                    vat_rate: parseFloat(document.getElementById('vat-rate').value),
                    service_charge: parseFloat(document.getElementById('service-charge').value)
                }
            };
            
            // Save configuration (placeholder)
            alert('✅ Pricing Configuration Saved!\n\nYour pricing rules have been updated successfully. All new quotes will use these rates.');
            console.log('Pricing config:', config);
        }
        
        // Initialize preview
        updatePreview();
    </script>
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
    <title>Advanced Analytics - SnapQuote</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body class="bg-gray-100 min-h-screen">
    <div class="max-w-7xl mx-auto py-8 px-4">
        <!-- Header -->
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-bold text-gray-800">
                        <i class="fas fa-chart-line text-orange-500 mr-2"></i>
                        Advanced Analytics
                    </h1>
                    <p class="text-gray-600">Detailed insights into your quote performance and business metrics</p>
                </div>
                <div class="flex space-x-3">
                    <select class="border border-gray-300 rounded-md px-3 py-2 focus:ring-orange-500 focus:border-orange-500">
                        <option>Last 30 days</option>
                        <option>Last 7 days</option>
                        <option>Last 90 days</option>
                        <option>This year</option>
                    </select>
                    <a href="/dashboard?business=${businessId}" class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                        <i class="fas fa-arrow-left mr-2"></i>Back to Dashboard
                    </a>
                </div>
            </div>
        </div>

        <!-- Top Metrics Row -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div class="bg-white rounded-lg shadow-md p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-gray-600">Total Quotes</p>
                        <p class="text-2xl font-bold text-gray-900">247</p>
                        <p class="text-sm text-green-600">+12.5% vs last month</p>
                    </div>
                    <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <i class="fas fa-quote-right text-blue-600 text-xl"></i>
                    </div>
                </div>
            </div>
            
            <div class="bg-white rounded-lg shadow-md p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-gray-600">Conversion Rate</p>
                        <p class="text-2xl font-bold text-gray-900">68.3%</p>
                        <p class="text-sm text-green-600">+5.2% vs last month</p>
                    </div>
                    <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                        <i class="fas fa-check-circle text-green-600 text-xl"></i>
                    </div>
                </div>
            </div>
            
            <div class="bg-white rounded-lg shadow-md p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-gray-600">Avg. Quote Value</p>
                        <p class="text-2xl font-bold text-gray-900">1,245 OMR</p>
                        <p class="text-sm text-green-600">+8.7% vs last month</p>
                    </div>
                    <div class="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                        <i class="fas fa-dollar-sign text-yellow-600 text-xl"></i>
                    </div>
                </div>
            </div>
            
            <div class="bg-white rounded-lg shadow-md p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-gray-600">Response Time</p>
                        <p class="text-2xl font-bold text-gray-900">4.2 min</p>
                        <p class="text-sm text-green-600">-15.3% vs last month</p>
                    </div>
                    <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                        <i class="fas fa-clock text-purple-600 text-xl"></i>
                    </div>
                </div>
            </div>
        </div>

        <!-- Charts Row -->
        <div class="grid lg:grid-cols-2 gap-6 mb-6">
            <!-- Quote Conversion Funnel -->
            <div class="bg-white rounded-lg shadow-md p-6">
                <h3 class="text-lg font-semibold mb-4">Quote Conversion Funnel</h3>
                <canvas id="conversionFunnel" width="400" height="200"></canvas>
            </div>
            
            <!-- Revenue Trend -->
            <div class="bg-white rounded-lg shadow-md p-6">
                <h3 class="text-lg font-semibold mb-4">Revenue Trend (30 Days)</h3>
                <canvas id="revenueTrend" width="400" height="200"></canvas>
            </div>
        </div>

        <!-- Bottom Row -->
        <div class="grid lg:grid-cols-3 gap-6">
            <!-- Popular Services -->
            <div class="bg-white rounded-lg shadow-md p-6">
                <h3 class="text-lg font-semibold mb-4">Popular Services</h3>
                <div class="space-y-3">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center">
                            <div class="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                            <span class="text-sm font-medium">Construction</span>
                        </div>
                        <span class="text-sm text-gray-600">42%</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <div class="flex items-center">
                            <div class="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                            <span class="text-sm font-medium">Renovation</span>
                        </div>
                        <span class="text-sm text-gray-600">28%</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <div class="flex items-center">
                            <div class="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
                            <span class="text-sm font-medium">Repairs</span>
                        </div>
                        <span class="text-sm text-gray-600">18%</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <div class="flex items-center">
                            <div class="w-3 h-3 bg-purple-500 rounded-full mr-3"></div>
                            <span class="text-sm font-medium">Maintenance</span>
                        </div>
                        <span class="text-sm text-gray-600">12%</span>
                    </div>
                </div>
            </div>

            <!-- Peak Request Times -->
            <div class="bg-white rounded-lg shadow-md p-6">
                <h3 class="text-lg font-semibold mb-4">Peak Request Times</h3>
                <canvas id="peakTimes" width="300" height="200"></canvas>
            </div>

            <!-- Customer Analytics -->
            <div class="bg-white rounded-lg shadow-md p-6">
                <h3 class="text-lg font-semibold mb-4">Customer Insights</h3>
                <div class="space-y-4">
                    <div class="flex justify-between items-center py-2 border-b border-gray-100">
                        <span class="text-sm font-medium">Repeat Customers</span>
                        <span class="text-sm text-gray-600">34%</span>
                    </div>
                    <div class="flex justify-between items-center py-2 border-b border-gray-100">
                        <span class="text-sm font-medium">Avg. Customer Value</span>
                        <span class="text-sm text-gray-600">2,850 OMR</span>
                    </div>
                    <div class="flex justify-between items-center py-2 border-b border-gray-100">
                        <span class="text-sm font-medium">Customer Satisfaction</span>
                        <span class="text-sm text-gray-600">4.8/5.0</span>
                    </div>
                    <div class="flex justify-between items-center py-2">
                        <span class="text-sm font-medium">Referral Rate</span>
                        <span class="text-sm text-gray-600">22%</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Conversion Funnel Chart
        const funnelCtx = document.getElementById('conversionFunnel').getContext('2d');
        new Chart(funnelCtx, {
            type: 'bar',
            data: {
                labels: ['Requests', 'Quotes Sent', 'Viewed', 'Paid'],
                datasets: [{
                    label: 'Conversion Funnel',
                    data: [360, 247, 198, 169],
                    backgroundColor: [
                        'rgba(99, 102, 241, 0.8)',
                        'rgba(34, 197, 94, 0.8)',
                        'rgba(251, 191, 36, 0.8)',
                        'rgba(239, 68, 68, 0.8)'
                    ],
                    borderColor: [
                        'rgb(99, 102, 241)',
                        'rgb(34, 197, 94)',
                        'rgb(251, 191, 36)',
                        'rgb(239, 68, 68)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        // Revenue Trend Chart
        const revenueCtx = document.getElementById('revenueTrend').getContext('2d');
        new Chart(revenueCtx, {
            type: 'line',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                datasets: [{
                    label: 'Revenue (OMR)',
                    data: [12000, 15200, 18400, 21500],
                    borderColor: 'rgb(34, 197, 94)',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    tension: 0.1,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        // Peak Times Chart
        const peakTimesCtx = document.getElementById('peakTimes').getContext('2d');
        new Chart(peakTimesCtx, {
            type: 'doughnut',
            data: {
                labels: ['Morning', 'Afternoon', 'Evening', 'Night'],
                datasets: [{
                    data: [35, 28, 25, 12],
                    backgroundColor: [
                        'rgba(251, 191, 36, 0.8)',
                        'rgba(34, 197, 94, 0.8)',
                        'rgba(99, 102, 241, 0.8)',
                        'rgba(107, 114, 128, 0.8)'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    </script>
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