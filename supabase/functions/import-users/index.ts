import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface UserToImport {
  row_number: number;
  email: string;
  first_name: string;
  last_name: string;
  company_name: string;
  role: string;
  phone: string;
  area_name: string | null;
}

interface ImportResult {
  success: number;
  errors: { row: number; message: string }[];
}

const VALID_ROLES = ["super_admin", "ceo", "diretor", "gerente", "colaborador"];

const handler = async (req: Request): Promise<Response> => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const result: ImportResult = { success: 0, errors: [] };

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the requesting user
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
      throw new Error("Apenas CEOs e Super Admins podem importar usuários");
    }

    const { users }: { users: UserToImport[] } = await req.json();

    if (!users || !Array.isArray(users)) {
      throw new Error("Lista de usuários inválida");
    }

    console.log(`Starting import of ${users.length} users`);

    // Fetch all companies and areas for mapping
    const [companiesRes, areasRes] = await Promise.all([
      supabaseAdmin.from("companies").select("id, name").eq("is_active", true),
      supabaseAdmin.from("areas").select("id, name"),
    ]);

    const companies = companiesRes.data || [];
    const areas = areasRes.data || [];

    // Process each user
    for (const userData of users) {
      const { row_number, email, first_name, last_name, company_name, role, phone, area_name } = userData;

      try {
        // Validate email
        if (!email || !email.includes('@')) {
          result.errors.push({ row: row_number, message: "Email inválido" });
          continue;
        }

        // Validate role
        if (!VALID_ROLES.includes(role)) {
          result.errors.push({ row: row_number, message: `Role inválida: ${role}` });
          continue;
        }

        // Find company
        const company = companies.find(c => c.name.toLowerCase() === company_name.toLowerCase());
        if (!company) {
          result.errors.push({ row: row_number, message: `Empresa não encontrada: ${company_name}` });
          continue;
        }

        // Find area (optional)
        let areaId = null;
        if (area_name) {
          const area = areas.find(a => a.name.toLowerCase() === area_name.toLowerCase());
          if (area) {
            areaId = area.id;
          }
        }

        // Check if user already exists
        const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
        const userExists = existingUser?.users?.some(u => u.email?.toLowerCase() === email.toLowerCase());
        
        if (userExists) {
          result.errors.push({ row: row_number, message: "Email já cadastrado" });
          continue;
        }

        console.log(`Creating user: ${email}`);

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
          result.errors.push({ row: row_number, message: createError.message });
          continue;
        }

        if (!newUser.user) {
          result.errors.push({ row: row_number, message: "Falha ao criar usuário" });
          continue;
        }

        // Update profile
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update({
            first_name,
            last_name,
            area_id: areaId,
            company_id: company.id,
            phone,
          })
          .eq("id", newUser.user.id);

        if (profileError) {
          console.error(`Error updating profile for ${email}:`, profileError);
        }

        // Delete default role (colaborador) created by trigger and insert the specified role
        await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", newUser.user.id);

        // Insert the specified role
        const { error: insertRoleError } = await supabaseAdmin
          .from("user_roles")
          .insert({
            user_id: newUser.user.id,
            role: role as "ceo" | "diretor" | "gerente" | "colaborador" | "super_admin",
          });

        if (insertRoleError) {
          console.error(`Error inserting role for ${email}:`, insertRoleError);
        }

        // Generate password reset link
        const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email,
        });

        if (resetError) {
          console.error(`Error generating reset link for ${email}:`, resetError);
        }

        // Send welcome email
        const resetLink = resetData?.properties?.action_link || "";
        
        try {
          await resend.emails.send({
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
          console.log(`Welcome email sent to ${email}`);
        } catch (emailError) {
          console.error(`Error sending email to ${email}:`, emailError);
        }

        result.success++;
        console.log(`User created successfully: ${email}`);

      } catch (userError: any) {
        console.error(`Error processing user at row ${row_number}:`, userError);
        result.errors.push({ row: row_number, message: userError.message || "Erro desconhecido" });
      }
    }

    console.log(`Import completed: ${result.success} success, ${result.errors.length} errors`);

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...getCorsHeaders(req),
        },
      }
    );
  } catch (error: any) {
    console.error("Error in import-users function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
      }
    );
  }
};

serve(handler);
