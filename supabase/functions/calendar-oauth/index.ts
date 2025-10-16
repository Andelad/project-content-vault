import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CalendarTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the authenticated user
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    const { method } = req
    const url = new URL(req.url)
    const action = url.searchParams.get('action')

    switch (method) {
      case 'POST': {
        if (action === 'store_tokens') {
          const { connection_id, tokens }: { connection_id: string; tokens: CalendarTokens } = await req.json()
          
          // Store tokens securely in Deno KV or encrypted format
          // For now, we'll just update the connection status
          const { error } = await supabaseClient
            .from('calendar_connections')
            .update({
              connection_status: 'connected',
              last_auth_at: new Date().toISOString(),
              auth_error_message: null
            })
            .eq('id', connection_id)
            .eq('user_id', user.id)

          if (error) {
            throw new Error(`Failed to update connection: ${error.message}`)
          }

          return new Response(
            JSON.stringify({ success: true }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          )
        }
        
        if (action === 'refresh_token') {
          const { connection_id }: { connection_id: string } = await req.json()
          
          // Here you would implement OAuth token refresh logic
          // For now, we'll simulate the process
          
          const { error } = await supabaseClient
            .from('calendar_connections')
            .update({
              connection_status: 'connected',
              last_auth_at: new Date().toISOString(),
              auth_error_message: null
            })
            .eq('id', connection_id)
            .eq('user_id', user.id)

          if (error) {
            throw new Error(`Failed to refresh connection: ${error.message}`)
          }

          return new Response(
            JSON.stringify({ success: true }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          )
        }
        break
      }

      case 'DELETE': {
        if (action === 'revoke_tokens') {
          const { connection_id }: { connection_id: string } = await req.json()
          
          // Here you would implement token revocation with the OAuth provider
          // For now, we'll update the connection status
          
          const { error } = await supabaseClient
            .from('calendar_connections')
            .update({
              connection_status: 'disconnected',
              last_auth_at: null,
              auth_error_message: null
            })
            .eq('id', connection_id)
            .eq('user_id', user.id)

          if (error) {
            throw new Error(`Failed to revoke connection: ${error.message}`)
          }

          return new Response(
            JSON.stringify({ success: true }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          )
        }
        break
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 405,
          }
        )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )

  } catch (error) {
    console.error('Calendar OAuth Error:', error)
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})