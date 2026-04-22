import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { imageBase64, mimeType } = await req.json()

    if (!imageBase64 || !mimeType) {
      return new Response(JSON.stringify({ success: false, error: 'Missing imageBase64 or mimeType' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mimeType, data: imageBase64 },
              },
              {
                type: 'text',
                text: `This is a Cameroonian national identity card (CNI) or passport. Extract all visible information and return ONLY a JSON object with these exact fields (use null for missing fields):
{
  "last_name": "",
  "first_name": "",
  "date_of_birth": "YYYY-MM-DD",
  "place_of_birth": "",
  "gender": "M or F",
  "nationality": "",
  "id_number": "",
  "id_issued_on": "YYYY-MM-DD",
  "id_issued_at": "",
  "usual_address": ""
}
Return ONLY the JSON, no explanation.`,
              },
            ],
          },
        ],
      }),
    })

    const data = await response.json()

    if (!data.content || !data.content[0]) {
      return new Response(JSON.stringify({ success: false, error: 'No response from AI' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const text = data.content[0].text

    try {
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      return new Response(JSON.stringify({ success: true, data: parsed }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'Could not parse ID card data', raw: text }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
