// WhatsApp Integration Service with Performance Monitoring

import type { CloudflareBindings, WhatsAppWebhook, WhatsAppMessage } from '../types';
import { createPerformanceTracker } from '../lib/monitoring/performance-tracker';

export class WhatsAppService {
  private env: CloudflareBindings;
  private tracker: ReturnType<typeof createPerformanceTracker>;

  constructor(env: CloudflareBindings, merchantId?: string) {
    this.env = env;
    this.tracker = createPerformanceTracker(env.DB, merchantId);
  }

  // Verify webhook signature from WhatsApp
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === this.env.WHATSAPP_VERIFY_TOKEN) {
      return challenge;
    }
    return null;
  }

  // Process incoming WhatsApp webhook
  async processWebhook(webhook: WhatsAppWebhook): Promise<void> {
    await this.tracker.trackEvent('whatsapp_message_received', true, {
      webhook_object: webhook.object
    });

    for (const entry of webhook.entry) {
      for (const change of entry.changes) {
        if (change.field === 'messages' && change.value.messages) {
          for (const message of change.value.messages) {
            await this.handleMessage(
              message,
              change.value.metadata.display_phone_number
            );
          }
        }
      }
    }
  }

  // Handle individual WhatsApp messages
  private async handleMessage(
    message: WhatsAppMessage,
    merchantPhone: string
  ): Promise<void> {
    try {
      // Find merchant by phone number
      const merchant = await this.env.DB.prepare(`
        SELECT * FROM merchants WHERE phone_number = ?
      `).bind(merchantPhone).first();

      if (!merchant) {
        console.error(`Merchant not found for phone: ${merchantPhone}`);
        return;
      }

      // Update tracker with merchant ID
      this.tracker = createPerformanceTracker(this.env.DB, merchant.id as string);

      // Get or create customer
      const customer = await this.findOrCreateCustomer(
        merchant.id as string,
        message.from
      );

      // Process based on message type
      if (message.type === 'image' && message.image) {
        await this.processImageMessage(
          merchant.id as string,
          customer.id,
          message
        );
      } else if (message.type === 'text' && message.text) {
        await this.processTextMessage(
          merchant.id as string,
          customer.id,
          message
        );
      }

      // Update customer last interaction
      await this.env.DB.prepare(`
        UPDATE customers 
        SET last_interaction = datetime('now') 
        WHERE id = ?
      `).bind(customer.id).run();

    } catch (error) {
      console.error('Error handling message:', error);
      await this.tracker.trackEvent('error_occurred', false, {
        error: error instanceof Error ? error.message : 'Unknown error',
        message_type: message.type
      }, message.from);
    }
  }

  // Process image messages for quote generation
  private async processImageMessage(
    merchantId: string,
    customerId: string,
    message: WhatsAppMessage
  ): Promise<void> {
    if (!message.image) return;

    try {
      // Download image from WhatsApp
      const imageUrl = await this.downloadMedia(message.image.id);
      await this.tracker.trackEvent('image_downloaded', true, {
        media_id: message.image.id
      }, message.from);

      // Send acknowledgment
      await this.sendMessage(
        message.from,
        "📸 Image received! I'm analyzing it now to prepare your quote..."
      );

      // Trigger AI analysis (this would be handled by AI service)
      await this.triggerImageAnalysis(
        merchantId,
        customerId,
        imageUrl,
        message.image.id,
        message.from
      );

    } catch (error) {
      console.error('Error processing image:', error);
      await this.sendMessage(
        message.from,
        "❌ Sorry, I couldn't process your image. Please try again."
      );
    }
  }

  // Process text messages
  private async processTextMessage(
    merchantId: string,
    customerId: string,
    message: WhatsAppMessage
  ): Promise<void> {
    if (!message.text) return;

    const text = message.text.body.toLowerCase();

    // Handle common commands
    if (text.includes('quote') || text.includes('estimate')) {
      await this.sendMessage(
        message.from,
        "📷 Please send me a photo of the area you need serviced, and I'll prepare a quote for you!"
      );
    } else if (text.includes('status')) {
      await this.sendQuoteStatus(merchantId, customerId, message.from);
    } else if (text.includes('help')) {
      await this.sendHelpMessage(message.from);
    } else {
      // Default response
      await this.sendMessage(
        message.from,
        "👋 Hi! Send me a photo to get an instant quote, or type 'help' for more options."
      );
    }
  }

  // Download media from WhatsApp
  private async downloadMedia(mediaId: string): Promise<string> {
    const response = await fetch(
      `https://graph.facebook.com/v17.0/${mediaId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.env.WHATSAPP_ACCESS_TOKEN}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get media URL: ${response.status}`);
    }

    const data = await response.json() as { url: string };

    // Download the actual media file
    const mediaResponse = await fetch(data.url, {
      headers: {
        'Authorization': `Bearer ${this.env.WHATSAPP_ACCESS_TOKEN}`
      }
    });

    if (!mediaResponse.ok) {
      throw new Error(`Failed to download media: ${mediaResponse.status}`);
    }

    // Store in R2 bucket
    const buffer = await mediaResponse.arrayBuffer();
    const key = `images/${Date.now()}-${mediaId}`;
    await this.env.R2.put(key, buffer);

    // Return the R2 URL (in production, this would be a CDN URL)
    return `https://snapquote-images.r2.dev/${key}`;
  }

  // Send WhatsApp message
  async sendMessage(to: string, text: string, buttons?: any[]): Promise<void> {
    const body: any = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'text',
      text: { body: text }
    };

    if (buttons && buttons.length > 0) {
      body.type = 'interactive';
      body.interactive = {
        type: 'button',
        body: { text: text },
        action: { buttons: buttons }
      };
    }

    const response = await fetch(
      'https://graph.facebook.com/v17.0/YOUR_PHONE_NUMBER_ID/messages',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send WhatsApp message: ${error}`);
    }
  }

  // Send quote with payment link
  async sendQuoteMessage(
    to: string,
    quote: any,
    paymentLink: string
  ): Promise<void> {
    const message = `
🎯 *Your Quote is Ready!*

Quote #: ${quote.quote_number}
Total: $${quote.total_amount.toFixed(2)}

*Services:*
${quote.items.map((item: any) => 
  `• ${item.description}: $${item.total_price.toFixed(2)}`
).join('\n')}

💳 *Ready to proceed?*
Click here to pay: ${paymentLink}

This quote is valid for 7 days.
    `.trim();

    await this.sendMessage(to, message, [
      {
        type: 'reply',
        reply: {
          id: 'accept_quote',
          title: '✅ Accept Quote'
        }
      },
      {
        type: 'reply',
        reply: {
          id: 'schedule_appointment',
          title: '📅 Schedule Service'
        }
      },
      {
        type: 'reply',
        reply: {
          id: 'request_changes',
          title: '✏️ Request Changes'
        }
      }
    ]);

    await this.tracker.trackEvent('quote_generated', true, {
      quote_id: quote.id,
      amount: quote.total_amount
    }, to);
  }

  // Send quote status
  private async sendQuoteStatus(
    merchantId: string,
    customerId: string,
    phoneNumber: string
  ): Promise<void> {
    const quotes = await this.env.DB.prepare(`
      SELECT * FROM quotes 
      WHERE merchant_id = ? AND customer_id = ? 
      ORDER BY created_at DESC 
      LIMIT 5
    `).bind(merchantId, customerId).all();

    if (quotes.results.length === 0) {
      await this.sendMessage(
        phoneNumber,
        "You don't have any quotes yet. Send me a photo to get started!"
      );
      return;
    }

    const statusMessage = quotes.results.map((q: any) => 
      `📋 Quote #${q.quote_number}: $${q.total_amount} - ${q.status}`
    ).join('\n');

    await this.sendMessage(phoneNumber, `Your recent quotes:\n\n${statusMessage}`);
  }

  // Send help message
  private async sendHelpMessage(phoneNumber: string): Promise<void> {
    const helpText = `
📱 *SnapQuote Help*

Here's what I can do:

📷 *Get a Quote*
Send me a photo of the area you need serviced

📊 *Check Status*
Type "status" to see your quotes

💳 *Make Payment*
Click the payment link in your quote

📅 *Schedule Service*
Reply to your quote to book an appointment

Need assistance? Contact support at support@snapquote.app
    `.trim();

    await this.sendMessage(phoneNumber, helpText);
  }

  // Find or create customer
  private async findOrCreateCustomer(
    merchantId: string,
    phoneNumber: string
  ): Promise<any> {
    let customer = await this.env.DB.prepare(`
      SELECT * FROM customers 
      WHERE merchant_id = ? AND phone_number = ?
    `).bind(merchantId, phoneNumber).first();

    if (!customer) {
      const result = await this.env.DB.prepare(`
        INSERT INTO customers (merchant_id, phone_number) 
        VALUES (?, ?) 
        RETURNING *
      `).bind(merchantId, phoneNumber).first();
      customer = result;
    }

    return customer;
  }

  // Trigger AI analysis for image
  private async triggerImageAnalysis(
    merchantId: string,
    customerId: string,
    imageUrl: string,
    mediaId: string,
    phoneNumber: string
  ): Promise<void> {
    // This would typically be a separate service
    // For now, we'll create a placeholder that triggers the AI service
    await this.env.KV.put(
      `analysis:${mediaId}`,
      JSON.stringify({
        merchant_id: merchantId,
        customer_id: customerId,
        image_url: imageUrl,
        phone_number: phoneNumber,
        timestamp: new Date().toISOString()
      }),
      { expirationTtl: 3600 } // 1 hour TTL
    );

    // In production, this would trigger an AI analysis worker
    console.log(`AI analysis queued for image: ${mediaId}`);
  }
}