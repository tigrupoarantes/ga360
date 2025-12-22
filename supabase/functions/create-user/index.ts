import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateUserRequest {
  email: string;
  first_name: string;
  last_name: string;
  area_id: string | null;
  company_id: string;
  role: string;
  phone?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the requesting user is CEO
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Não autorizado");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requestingUser) {
      throw new Error("Não autorizado");
    }

    // Check if requesting user is CEO or Super Admin
    const { data: roleCheck } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .in("role", ["ceo", "super_admin"])
      .limit(1);

    if (!roleCheck || roleCheck.length === 0) {
      throw new Error("Apenas CEOs e Super Admins podem criar usuários");
    }

    const { email, first_name, last_name, area_id, company_id, role, phone }: CreateUserRequest = await req.json();

    console.log("Creating user:", { email, first_name, last_name, company_id, role });

    // Create user in auth
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        first_name,
        last_name,
      },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      throw new Error(`Erro ao criar usuário: ${createError.message}`);
    }

    if (!newUser.user) {
      throw new Error("Falha ao criar usuário");
    }

    console.log("User created successfully:", newUser.user.id);

    // Update profile
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        first_name,
        last_name,
        area_id,
        company_id,
        phone,
      })
      .eq("id", newUser.user.id);

    if (profileError) {
      console.error("Error updating profile:", profileError);
    }

    // Delete default role (colaborador) created by trigger and insert the specified role
    const { error: deleteRoleError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", newUser.user.id);

    if (deleteRoleError) {
      console.error("Error deleting default role:", deleteRoleError);
    }

    // Insert the specified single role
    const { error: insertRoleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: newUser.user.id,
        role: role as "ceo" | "diretor" | "gerente" | "colaborador" | "super_admin",
      });

    if (insertRoleError) {
      console.error("Error inserting role:", insertRoleError);
      throw new Error(`Erro ao atribuir role: ${insertRoleError.message}`);
    }

    // Generate password reset link
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (resetError) {
      console.error("Error generating reset link:", resetError);
    }

    // Send welcome email
    const resetLink = resetData?.properties?.action_link || "";
    
    const emailResponse = await resend.emails.send({
      from: "GA 360 <onboarding@resend.dev>",
      to: [email],
      subject: "Bem-vindo ao GA 360!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #0B3D91;">Bem-vindo ao GA 360!</h1>
          <p>Olá ${first_name},</p>
          <p>Sua conta foi criada com sucesso no sistema GA 360 do Grupo Arantes.</p>
          <p>Para definir sua senha e acessar o sistema, clique no botão abaixo:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="background-color: #0B3D91; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Definir Senha
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            Este link expirará em 24 horas. Se você não solicitou esta conta, ignore este email.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
            GA 360 - Grupo Arantes<br>
            Sistema de Gestão Estratégica
          </p>
        </div>
      `,
    });

    console.log("Welcome email sent:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: { id: newUser.user.id, email: newUser.user.email } 
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in create-user function:", error);
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
