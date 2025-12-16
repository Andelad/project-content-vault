/// <reference types="https://esm.sh/v135/@supabase/functions-js/src/deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type LegacyEventRow = {
  id: string;
  title: string;
  recurring_type: string;
  recurring_interval: number | null;
  recurring_end_date: string | null;
  recurring_count: number | null;
  rrule: string | null;
};

type MigrationFailure = { id: string; title: string; error: string };
type MigratedEventSummary = { id: string; title: string; legacyFormat: string; rrule: string };

/**
 * Convert legacy recurring event data to RRULE string
 */
function convertLegacyToRRule(
  recurringType: string,
  interval: number = 1,
  endDate?: string | null,
  count?: number | null
): string {
  const parts: string[] = [];
  
  parts.push(`FREQ=${recurringType.toUpperCase()}`);
  parts.push(`INTERVAL=${interval}`);
  
  if (endDate) {
    const untilStr = new Date(endDate).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    parts.push(`UNTIL=${untilStr}`);
  }
  
  if (count) {
    parts.push(`COUNT=${count}`);
  }
  
  return parts.join(';');
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Create client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify the user is authenticated (using their token)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('🚀 Starting RRULE migration...');

    // Fetch all events with legacy recurring format (has recurring_type but no rrule)
    const { data: legacyEvents, error: fetchError } = await supabaseAdmin
      .from('calendar_events')
      .select('id,title,recurring_type,recurring_interval,recurring_end_date,recurring_count,rrule')
      .not('recurring_type', 'is', null)
      .is('rrule', null);

    if (fetchError) throw fetchError;

    if (!legacyEvents || legacyEvents.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No legacy recurring events found. Migration complete!',
          summary: {
            total: 0,
            migrated: 0,
            failed: 0
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    console.log(`📊 Found ${legacyEvents.length} legacy recurring events to migrate`);

    let successCount = 0;
    let failureCount = 0;
  const failures: MigrationFailure[] = [];
  const migrated: MigratedEventSummary[] = [];

    // Process each event
    for (const event of legacyEvents) {
      try {
        const rrule = convertLegacyToRRule(
          event.recurring_type,
          event.recurring_interval || 1,
          event.recurring_end_date,
          event.recurring_count || undefined
        );

        // Update event with RRULE
        const { error: updateError } = await supabaseAdmin
          .from('calendar_events')
          .update({ rrule })
          .eq('id', event.id);

        if (updateError) throw updateError;

        successCount++;
        migrated.push({
          id: event.id,
          title: event.title,
          legacyFormat: `${event.recurring_type} every ${event.recurring_interval || 1}`,
          rrule
        });
        
        console.log(`✓ Migrated event ${event.id}: ${event.title}`);
      } catch (error) {
        failureCount++;
        const message = error instanceof Error ? error.message : 'Unknown error';
        failures.push({
          id: event.id,
          title: event.title,
          error: message
        });
        console.error(`✗ Failed to migrate event ${event.id}: ${message}`);
      }
    }

    const summary = {
      total: legacyEvents.length,
      migrated: successCount,
      failed: failureCount,
      migratedEvents: migrated,
      failures
    };

    console.log('📈 Migration Summary:', summary);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Migration completed: ${successCount} events migrated, ${failureCount} failed`,
        summary
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Migration failed:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
