import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';

interface EmployeeToConvert {
  id: string;
  email: string;
  full_name: string;
  company_id: string | null;
  phone: string | null;
}

interface ConversionResult {
  success: number;
  skipped: number;
  errors: { email: string; error: string }[];
  created: { email: string; name: string }[];
}

const handler = async (req: Request): Promise<Response> => {
  console.log("create-users-from-employees function called");

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header and verify user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header");
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !userData.user) {
      console.error("Error getting user:", userError);
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;
    console.log("User ID:", userId);

    // Check if user has ceo or super_admin role
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (rolesError) {
      console.error("Error fetching roles:", rolesError);
      return new Response(
        JSON.stringify({ error: "Erro ao verificar permissões" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const userRoles = roles?.map(r => r.role) || [];
    const hasPermission = userRoles.includes("ceo") || userRoles.includes("super_admin");

    if (!hasPermission) {
      console.error("User does not have permission:", userRoles);
      return new Response(
        JSON.stringify({ error: "Sem permissão para esta operação" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { employeeIds } = await req.json();

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "Lista de funcionários vazia" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${employeeIds.length} employees`);

    // Fetch employees to convert
    const { data: employees, error: employeesError } = await supabaseAdmin
      .from("external_employees")
      .select("id, email, full_name, company_id, phone")
      .in("id", employeeIds)
      .not("email", "is", null)
      .is("linked_profile_id", null);

    if (employeesError) {
      console.error("Error fetching employees:", employeesError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar funcionários" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${employees?.length || 0} eligible employees`);

    const result: ConversionResult = {
      success: 0,
      skipped: 0,
      errors: [],
      created: [],
    };

    // Check if Resend API key exists for email sending
    const hasResend = !!resendApiKey;

    for (const employee of employees as EmployeeToConvert[]) {
      try {
        console.log(`Processing employee: ${employee.email}`);

        // Check if user already exists
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(
          u => u.email?.toLowerCase() === employee.email.toLowerCase()
        );

        if (existingUser) {
          console.log(`User already exists: ${employee.email}`);
          result.skipped++;
          continue;
        }

        // Parse name
        const nameParts = employee.full_name.trim().split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        // Create user in auth.users
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: employee.email,
          email_confirm: true,
          user_metadata: {
            first_name: firstName,
            last_name: lastName,
          },
        });

        if (createError || !newUser.user) {
          console.error(`Error creating user ${employee.email}:`, createError);
          result.errors.push({ 
            email: employee.email, 
            error: createError?.message || "Erro ao criar usuário" 
          });
          continue;
        }

        console.log(`User created: ${newUser.user.id}`);

        // Update profile with employee data
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update({
            first_name: firstName,
            last_name: lastName,
            company_id: employee.company_id,
            phone: employee.phone,
            is_active: true,
          })
          .eq("id", newUser.user.id);

        if (profileError) {
          console.error(`Error updating profile for ${employee.email}:`, profileError);
        }

        // Assign colaborador role
        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .insert({
            user_id: newUser.user.id,
            role: "colaborador",
          });

        if (roleError) {
          console.error(`Error assigning role for ${employee.email}:`, roleError);
        }

        // Link external employee to profile
        const { error: linkError } = await supabaseAdmin
          .from("external_employees")
          .update({ linked_profile_id: newUser.user.id })
          .eq("id", employee.id);

        if (linkError) {
          console.error(`Error linking employee ${employee.email}:`, linkError);
        }

        // Generate password reset link and send email via edge function
        if (hasResend) {
          try {
            const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
              type: "recovery",
              email: employee.email,
            });

            if (!resetError && resetData?.properties?.action_link) {
              const resetLink = resetData.properties.action_link;
              
              // Call send-email-smtp edge function for sending email
              const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email-smtp`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({
                  to: employee.email,
                  subject: "Bem-vindo ao GA360 - Configure sua senha",
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                      <h1 style="color: #1a1a2e;">Bem-vindo ao GA360!</h1>
                      <p>Olá ${firstName},</p>
                      <p>Sua conta foi criada no sistema GA360. Para acessar, você precisa definir sua senha.</p>
                      <p>
                        <a href="${resetLink}" 
                           style="display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
                          Definir minha senha
                        </a>
                      </p>
                      <p style="color: #666; font-size: 14px;">
                        Este link é válido por 24 horas. Se expirar, solicite um novo através da opção "Esqueci minha senha" na tela de login.
                      </p>
                      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                      <p style="color: #999; font-size: 12px;">
                        Este email foi enviado automaticamente. Por favor, não responda.
                      </p>
                    </div>
                  `,
                }),
              });

              if (emailResponse.ok) {
                console.log(`Welcome email sent to ${employee.email}`);
              } else {
                console.error(`Failed to send email to ${employee.email}:`, await emailResponse.text());
              }
            }
          } catch (emailError) {
            console.error(`Error sending email to ${employee.email}:`, emailError);
          }
        }

        result.success++;
        result.created.push({ email: employee.email, name: employee.full_name });
        console.log(`Successfully processed: ${employee.email}`);

      } catch (err) {
        console.error(`Error processing employee ${employee.email}:`, err);
        result.errors.push({ 
          email: employee.email, 
          error: err instanceof Error ? err.message : "Erro desconhecido" 
        });
      }
    }

    console.log("Conversion complete:", result);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in create-users-from-employees:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
