// AI Image Analysis Service with Configurable Confidence Thresholds

import type { 
  CloudflareBindings, 
  ImageAnalysis, 
  AnalysisResult,
  DetectedService,
  Measurements,
  Merchant
} from '../types';
import { createPerformanceTracker } from '../lib/monitoring/performance-tracker';

export class AIAnalysisService {
  private env: CloudflareBindings;
  private merchant: Merchant;
  private tracker: ReturnType<typeof createPerformanceTracker>;

  constructor(env: CloudflareBindings, merchant: Merchant) {
    this.env = env;
    this.merchant = merchant;
    this.tracker = createPerformanceTracker(env.DB, merchant.id);
  }

  // Analyze image using OpenAI Vision API
  async analyzeImage(
    imageUrl: string,
    customerId: string,
    mediaId?: string
  ): Promise<ImageAnalysis | null> {
    const startTime = Date.now();

    try {
      // Get service types for this merchant
      const serviceTypes = await this.getServiceTypes();
      
      // Prepare the prompt based on merchant's business type
      const prompt = this.buildAnalysisPrompt(serviceTypes);

      // Call OpenAI Vision API
      const analysis = await this.callOpenAIVision(imageUrl, prompt);
      
      // Parse and validate the analysis
      const parsedAnalysis = this.parseAnalysisResult(analysis);
      
      // Check confidence threshold
      if (parsedAnalysis.confidence < this.merchant.ai_confidence_threshold) {
        console.warn(`AI confidence ${parsedAnalysis.confidence} below threshold ${this.merchant.ai_confidence_threshold}`);
        
        // Track low confidence event
        await this.tracker.trackEvent('ai_analysis_completed', false, {
          reason: 'low_confidence',
          confidence: parsedAnalysis.confidence,
          threshold: this.merchant.ai_confidence_threshold
        });
        
        return null;
      }

      // Extract measurements and services
      const measurements = this.extractMeasurements(parsedAnalysis);
      const detectedServices = await this.matchServices(parsedAnalysis, serviceTypes);

      // Store analysis in database
      const analysisId = crypto.randomUUID();
      const processingTime = Date.now() - startTime;

      await this.env.DB.prepare(`
        INSERT INTO image_analyses (
          id, merchant_id, customer_id, image_url, whatsapp_media_id,
          analysis_result, ai_confidence, ai_model, processing_time_ms,
          detected_services, measurements
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        analysisId,
        this.merchant.id,
        customerId,
        imageUrl,
        mediaId || null,
        JSON.stringify(parsedAnalysis.result),
        parsedAnalysis.confidence,
        'gpt-4o-vision',
        processingTime,
        JSON.stringify(detectedServices),
        JSON.stringify(measurements)
      ).run();

      // Track successful analysis
      await this.tracker.trackAIAnalysis(
        analysisId,
        processingTime,
        parsedAnalysis.confidence,
        'gpt-4o-vision',
        true
      );

      return {
        id: analysisId,
        merchant_id: this.merchant.id,
        customer_id: customerId,
        image_url: imageUrl,
        whatsapp_media_id: mediaId,
        analysis_result: parsedAnalysis.result,
        ai_confidence: parsedAnalysis.confidence,
        ai_model: 'gpt-4o-vision',
        processing_time_ms: processingTime,
        detected_services: detectedServices,
        measurements: measurements,
        created_at: new Date().toISOString()
      };

    } catch (error) {
      console.error('AI analysis error:', error);
      
      const processingTime = Date.now() - startTime;
      await this.tracker.trackAIAnalysis(
        'error',
        processingTime,
        0,
        'gpt-4o-vision',
        false
      );
      
      throw error;
    }
  }

  // Build analysis prompt based on merchant's services
  private buildAnalysisPrompt(serviceTypes: any[]): string {
    const services = serviceTypes.map(s => s.service_name).join(', ');
    
    return `
You are an expert estimator for a ${this.merchant.business_name} business that provides the following services: ${services}.

Analyze this image and provide a detailed assessment for quote generation. Return a JSON object with this exact structure:

{
  "confidence": 0.85,  // Your confidence level (0.0 to 1.0)
  "description": "Brief description of what you see",
  "detected_items": [
    {
      "item": "Item name",
      "confidence": 0.9,
      "quantity": 1,
      "dimensions": {
        "width": 10,
        "height": 8,
        "area": 80,
        "unit": "feet"
      }
    }
  ],
  "suggested_services": ["Service 1", "Service 2"],
  "estimated_complexity": "medium",  // low, medium, or high
  "measurements": {
    "total_area": 500,
    "linear_feet": 100,
    "count": 5,
    "unit": "sqft"
  },
  "notes": "Any additional observations"
}

Be precise with measurements when possible. If you cannot determine exact measurements, provide reasonable estimates based on visible references.
Focus on items and areas relevant to these services: ${services}
    `.trim();
  }

  // Call OpenAI Vision API
  private async callOpenAIVision(imageUrl: string, prompt: string): Promise<any> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json() as any;
    const content = data.choices[0].message.content;

    // Parse JSON from response
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('No JSON found in response');
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Invalid AI response format');
    }
  }

  // Parse and validate analysis result
  private parseAnalysisResult(analysis: any): {
    result: AnalysisResult;
    confidence: number;
  } {
    // Validate required fields
    if (!analysis.confidence || !analysis.detected_items) {
      throw new Error('Invalid analysis result structure');
    }

    const result: AnalysisResult = {
      description: analysis.description || 'Image analysis completed',
      detected_items: analysis.detected_items || [],
      suggested_services: analysis.suggested_services || [],
      estimated_complexity: analysis.estimated_complexity || 'medium',
      notes: analysis.notes
    };

    return {
      result,
      confidence: parseFloat(analysis.confidence) || 0.5
    };
  }

  // Extract measurements from analysis
  private extractMeasurements(analysis: any): Measurements {
    const measurements = analysis.result.measurements || analysis.measurements || {};
    
    return {
      area: measurements.total_area || measurements.area,
      linear_feet: measurements.linear_feet,
      count: measurements.count,
      hours_estimated: this.estimateHours(analysis.result.estimated_complexity),
      unit: measurements.unit || 'sqft'
    };
  }

  // Estimate hours based on complexity
  private estimateHours(complexity: string): number {
    const estimates: Record<string, number> = {
      'low': 2,
      'medium': 4,
      'high': 8
    };
    return estimates[complexity] || 4;
  }

  // Match detected items to merchant's services
  private async matchServices(
    analysis: any,
    serviceTypes: any[]
  ): Promise<DetectedService[]> {
    const detectedServices: DetectedService[] = [];
    const suggestedServices = analysis.result.suggested_services || [];

    for (const service of serviceTypes) {
      // Check if service name matches any suggested service
      const isMatch = suggestedServices.some((suggested: string) =>
        suggested.toLowerCase().includes(service.service_name.toLowerCase()) ||
        service.service_name.toLowerCase().includes(suggested.toLowerCase())
      );

      if (isMatch) {
        // Calculate quantity based on measurements
        const measurements = analysis.measurements || {};
        let quantity = 1;
        let unit = 'unit';

        if (service.unit_type === 'sqft' && measurements.total_area) {
          quantity = measurements.total_area;
          unit = 'sqft';
        } else if (service.unit_type === 'hour' && measurements.hours_estimated) {
          quantity = measurements.hours_estimated;
          unit = 'hour';
        } else if (service.unit_type === 'item' && measurements.count) {
          quantity = measurements.count;
          unit = 'item';
        }

        detectedServices.push({
          service_type_id: service.id,
          service_name: service.service_name,
          quantity: quantity,
          unit: unit,
          confidence: analysis.confidence || 0.75
        });
      }
    }

    // If no services matched, add the most common service as a fallback
    if (detectedServices.length === 0 && serviceTypes.length > 0) {
      const defaultService = serviceTypes[0];
      detectedServices.push({
        service_type_id: defaultService.id,
        service_name: defaultService.service_name,
        quantity: 1,
        unit: defaultService.unit_type || 'unit',
        confidence: 0.5
      });
    }

    return detectedServices;
  }

  // Get service types for merchant
  private async getServiceTypes(): Promise<any[]> {
    const result = await this.env.DB.prepare(`
      SELECT * FROM service_types 
      WHERE merchant_id = ? AND is_active = 1
      ORDER BY service_name
    `).bind(this.merchant.id).all();

    return result.results;
  }

  // Batch analyze multiple images
  async batchAnalyze(
    images: Array<{ url: string; customerId: string; mediaId?: string }>
  ): Promise<Array<ImageAnalysis | null>> {
    const results = await Promise.allSettled(
      images.map(img => this.analyzeImage(img.url, img.customerId, img.mediaId))
    );

    return results.map(result => 
      result.status === 'fulfilled' ? result.value : null
    );
  }

  // Re-analyze with different parameters
  async reanalyze(
    analysisId: string,
    newThreshold?: number
  ): Promise<ImageAnalysis | null> {
    // Get original analysis
    const original = await this.env.DB.prepare(`
      SELECT * FROM image_analyses WHERE id = ?
    `).bind(analysisId).first() as any;

    if (!original) {
      throw new Error('Analysis not found');
    }

    // Update threshold if provided
    if (newThreshold !== undefined) {
      this.merchant.ai_confidence_threshold = newThreshold;
    }

    // Re-analyze the image
    return this.analyzeImage(
      original.image_url,
      original.customer_id,
      original.whatsapp_media_id
    );
  }

  // Get analysis history for customer
  async getCustomerAnalysisHistory(customerId: string): Promise<any[]> {
    const result = await this.env.DB.prepare(`
      SELECT * FROM image_analyses 
      WHERE merchant_id = ? AND customer_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).bind(this.merchant.id, customerId).all();

    return result.results;
  }
}