import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ConfirmAttendanceRequest {
  token: string;
  action: "confirm" | "decline";
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { token, action }: ConfirmAttendanceRequest = await req.json();

    console.log("Processing attendance confirmation:", { token, action });

    // Buscar participante pelo token
    const { data: participant, error: participantError } = await supabase
      .from("meeting_participants")
      .select(`
        id,
        meeting_id,
        user_id,
        confirmation_status,
        meetings!inner(title, scheduled_at)
      `)
      .eq("confirmation_token", token)
      .maybeSingle();

    if (participantError || !participant) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired confirmation token" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Verificar se a reunião já passou
    const meetingDate = new Date((participant.meetings as any).scheduled_at);
    if (meetingDate < new Date()) {
      return new Response(
        JSON.stringify({ error: "Meeting has already passed" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Atualizar status de confirmação
    const newStatus = action === "confirm" ? "confirmed" : "declined";
    const updateData: any = {
      confirmation_status: newStatus,
    };

    if (action === "confirm") {
      updateData.confirmed_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("meeting_participants")
      .update(updateData)
      .eq("id", participant.id);

    if (updateError) throw updateError;

    console.log(`Attendance ${action}ed for participant ${participant.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Attendance ${action}ed successfully`,
        meeting: {
          title: (participant.meetings as any).title,
          scheduledAt: (participant.meetings as any).scheduled_at,
        },
        status: newStatus,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in confirm-attendance:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
