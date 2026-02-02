import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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
  console.log("=== CREATE-USER FUNCTION START ===");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Cliente admin com service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar autorização
    const authHeader = req.headers.get("Authorization");
    console.log("Auth header present:", !!authHeader);
    
    if (!authHeader) {
      console.error("No authorization header");
      return new Response(
        JSON.stringify({ error: "Não autorizado - header ausente" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("Token length:", token.length);

    // Validar o token usando getUser com o token explícito
    const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    console.log("Auth validation result:", { 
      hasUser: !!userData?.user, 
      error: authError?.message 
    });

    if (authError || !userData?.user) {
      console.error("Auth error:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Não autorizado - token inválido" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const requestingUser = userData.user;
    console.log("Requesting user ID:", requestingUser.id);

    // Verificar se o usuário é CEO ou Super Admin
    const { data: roleCheck, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .in("role", ["ceo", "super_admin"]);

    console.log("Role check result:", { roles: roleCheck, error: roleError?.message });

    if (roleError || !roleCheck || roleCheck.length === 0) {
      console.error("Role check failed");
      return new Response(
        JSON.stringify({ error: "Apenas CEOs e Super Admins podem criar usuários" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const body: CreateUserRequest = await req.json();
    const { email, first_name, last_name, area_id, company_id, role, phone } = body;

    console.log("Creating user:", { email, first_name, last_name, company_id, role });

    // Criar usuário no auth
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        first_name,
        last_name,
      },
    });

    if (createError) {
      console.error("Error creating user:", createError.message);
      return new Response(
        JSON.stringify({ error: `Erro ao criar usuário: ${createError.message}` }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!newUser.user) {
      console.error("User not created");
      return new Response(
        JSON.stringify({ error: "Falha ao criar usuário" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("User created successfully:", newUser.user.id);

    // Atualizar profile
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
      console.error("Error updating profile:", profileError.message);
    }

    // Deletar role padrão (colaborador) criada pelo trigger e inserir a role especificada
    const { error: deleteRoleError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", newUser.user.id);

    if (deleteRoleError) {
      console.error("Error deleting default role:", deleteRoleError.message);
    }

    // Inserir a role especificada
    const { error: insertRoleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: newUser.user.id,
        role: role as "ceo" | "diretor" | "gerente" | "colaborador" | "super_admin",
      });

    if (insertRoleError) {
      console.error("Error inserting role:", insertRoleError.message);
      return new Response(
        JSON.stringify({ error: `Erro ao atribuir role: ${insertRoleError.message}` }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Gerar link de magic link
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (resetError) {
      console.error("Error generating reset link:", resetError.message);
    }

    const resetLink = resetData?.properties?.action_link || "";
    console.log("Magic link generated:", !!resetLink);

    // Enviar email de boas-vindas via SMTP
    try {
      const smtpHost = Deno.env.get("SMTP_HOST") || "mail.grupoarantes.emp.br";
      const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
      const smtpUser = Deno.env.get("SMTP_USER") || "ga360@grupoarantes.emp.br";
      const smtpPassword = Deno.env.get("SMTP_PASSWORD");

      if (smtpPassword) {
        console.log("Sending welcome email via SMTP...");
        
        const client = new SMTPClient({
          connection: {
            hostname: smtpHost,
            port: smtpPort,
            tls: true,
            auth: {
              username: smtpUser,
              password: smtpPassword,
            },
          },
        });

        await client.send({
          from: `GA 360 <${smtpUser}>`,
          to: email,
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

        await client.close();
        console.log("Welcome email sent successfully");
      } else {
        console.warn("SMTP_PASSWORD not configured, skipping email");
      }
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      // Não falhar a criação do usuário por causa do email
    }

    console.log("=== CREATE-USER FUNCTION SUCCESS ===");

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: { id: newUser.user.id, email: newUser.user.email } 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
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
