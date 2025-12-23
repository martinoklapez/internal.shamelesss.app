/**
 * Replicate API client for image generation
 */

const REPLICATE_API_URL = 'https://api.replicate.com/v1'

export interface ReplicatePrediction {
  id: string
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
  output?: string | string[]
  error?: string
  urls?: {
    get: string
    cancel: string
  }
}

/**
 * Create a prediction with Replicate API
 */
export async function createPrediction(
  model: string,
  input: Record<string, any>
): Promise<ReplicatePrediction> {
  const apiToken = process.env.REPLICATE_API_TOKEN

  if (!apiToken) {
    throw new Error('REPLICATE_API_TOKEN environment variable is not set')
  }

  // For official models, use the models endpoint: /v1/models/{owner}/{name}/predictions
  // This doesn't require a version field - just the input
  const [owner, name] = model.split('/')
  if (!owner || !name) {
    throw new Error(`Invalid model format: ${model}. Expected format: owner/model-name`)
  }

  const url = `${REPLICATE_API_URL}/models/${owner}/${name}/predictions`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input, // Only send input, no version/model field needed for official models
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    const errorMessage = error.detail || error.error || error.message || JSON.stringify(error) || response.statusText
    console.error('Replicate API error:', error)
    throw new Error(`Replicate API error: ${errorMessage}`)
  }

  return response.json()
}

/**
 * Get prediction status
 */
export async function getPrediction(predictionId: string): Promise<ReplicatePrediction> {
  const apiToken = process.env.REPLICATE_API_TOKEN

  if (!apiToken) {
    throw new Error('REPLICATE_API_TOKEN environment variable is not set')
  }

  const response = await fetch(`${REPLICATE_API_URL}/predictions/${predictionId}`, {
    headers: {
      'Authorization': `Bearer ${apiToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    const errorMessage = error.detail || error.error || error.message || JSON.stringify(error) || response.statusText
    console.error('Replicate API error:', error)
    throw new Error(`Replicate API error: ${errorMessage}`)
  }

  return response.json()
}

/**
 * Poll prediction until completion
 */
export async function pollPrediction(
  predictionId: string,
  onProgress?: (status: string) => void
): Promise<ReplicatePrediction> {
  let prediction = await getPrediction(predictionId)

  while (prediction.status === 'starting' || prediction.status === 'processing') {
    if (onProgress) {
      onProgress(prediction.status)
    }
    await new Promise((resolve) => setTimeout(resolve, 2000)) // Wait 2 seconds
    prediction = await getPrediction(predictionId)
  }

  if (prediction.status === 'failed' || prediction.status === 'canceled') {
    throw new Error(prediction.error || `Prediction ${prediction.status}`)
  }

  return prediction
}

/**
 * Get model schema to see what input parameters it accepts
 */
export async function getModelSchema(model: string): Promise<any> {
  const apiToken = process.env.REPLICATE_API_TOKEN

  if (!apiToken) {
    throw new Error('REPLICATE_API_TOKEN environment variable is not set')
  }

  const [owner, name] = model.split('/')
  if (!owner || !name) {
    throw new Error(`Invalid model format: ${model}`)
  }

  const response = await fetch(`${REPLICATE_API_URL}/models/${owner}/${name}`, {
    headers: {
      'Authorization': `Bearer ${apiToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch model: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Generate image using Nano Banana Pro model
 * @param prompt - Text prompt for image generation
 * @param referenceImageUrls - Array of reference image URLs
 * @param options - Optional parameters for aspect_ratio, resolution, and output_format
 * @returns Object with image URL and prediction ID
 */
export async function generateImage(
  prompt: string,
  referenceImageUrls: string[] = [],
  options?: {
    aspect_ratio?: string
    resolution?: string
    output_format?: string
  }
): Promise<{ imageUrl: string; predictionId: string }> {
  // Nano Banana Pro model identifier
  const model = 'google/nano-banana-pro'

  const input: Record<string, any> = {
    prompt,
  }

  // Add reference images if provided
  // nano-banana-pro uses 'image_input' parameter and expects an array
  if (referenceImageUrls.length > 0) {
    input.image_input = referenceImageUrls // Always use array format
    console.log(`Using 'image_input' parameter with ${referenceImageUrls.length} reference image(s)`)
  }

  // Add optional parameters if provided
  if (options?.aspect_ratio) {
    input.aspect_ratio = options.aspect_ratio
  }
  if (options?.resolution) {
    // Convert lowercase 'k' to uppercase 'K' for Replicate API
    input.resolution = options.resolution.toUpperCase()
  }
  if (options?.output_format) {
    input.output_format = options.output_format
  }

  console.log('Sending to Replicate:', {
    model,
    input: {
      ...input,
      // Don't log full URLs in production, but useful for debugging
      prompt: input.prompt?.substring(0, 100) + '...',
      image_count: referenceImageUrls.length,
    },
  })

  const prediction = await createPrediction(model, input)
  const completed = await pollPrediction(prediction.id)

  if (!completed.output) {
    throw new Error('No output from Replicate prediction')
  }

  // Handle both single string and array outputs
  const output = Array.isArray(completed.output)
    ? completed.output[0]
    : completed.output

  if (typeof output !== 'string') {
    throw new Error('Unexpected output format from Replicate')
  }

  return {
    imageUrl: output,
    predictionId: completed.id,
  }
}

