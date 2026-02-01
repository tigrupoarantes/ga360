import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// Interface para o registro de funcionário - suporta formato novo (Gestão de Ativos) e antigo
interface EmployeeRecord {
  // Formato novo (Gestão de Ativos)
  id?: string;
  nome?: string;
  cpf?: string;
  cargo?: string;
  departamento?: string;
  unidade?: string;
  status?: string;
  is_condutor?: boolean;
  cod_vendedor?: string;
  lider_direto_id?: string;
  
  // Campos CNH (Gestão de Ativos)
  cnh_numero?: string;
  cnh_categoria?: string;
  cnh_validade?: string;
  
  // Formato antigo (retrocompatibilidade)
  external_id?: string;
  full_name?: string;
  position?: string;
  department?: string;
  registration_number?: string;
  is_active?: boolean;
  
  // Campos comuns
  email?: string;
  phone?: string;
  hire_date?: string;
  metadata?: Record<string, any>;
}

// Mapeamento de CPF para email
const cpfEmailMap: Record<string, string> = {
  '36448116877': 'alan@brkarantes.com.br',
  '13258414807': 'alexandro.oliveira@brkarantes.com.br',
  '26359527871': 'anderson@brkarantes.com.br',
  '31094300888': 'anderson.chaves@brkarantes.com.br',
  '36166166893': 'anderson.schmitz@brkarantes.com.br',
  '39117950848': 'bianca@brkarantes.com.br',
  '75238276672': 'claudio.vilela@grupoarantes.emp.br',
  '32867748801': 'danilo.gomes@brkarantes.com.br',
  '22145484833': 'eder@brkarantes.com.br',
  '47983021801': 'fernando@brkarantes.com.br',
  '25641351881': 'gilberto.santana@brkarantes.com.br',
  '14544749808': 'henrique.rezende@brkarantes.com.br',
  '39925394821': 'jean@brkarantes.com.br',
  '35588183851': 'joao.antonio@brkarantes.com.br',
  '28035786890': 'jose.neto@brkarantes.com.br',
  '48791005876': 'julia.cassiano@brkarantes.com.br',
  '27814489822': 'katiucia@brkarantes.com.br',
  '42450963812': 'laysa@brkarantes.com.br',
  '47768587898': 'lucas.avelar@brkarantes.com.br',
  '30972243860': 'luciano.mechia@brkarantes.com.br',
  '11430368837': 'marcelo.marques@brkarantes.com.br',
  '21487099843': 'rafael.henrique@brkarantes.com.br',
  '35889412825': 'ramiro.arantes@brkarantes.com.br',
  '38426190812': 'robinson@brkarantes.com.br',
  '38277269803': 'rodrigo.cesar@brkarantes.com.br',
  '29953531846': 'rodrigo.nogueira@brkarantes.com.br',
  '26243882810': 'ronaldo.lima@brkarantes.com.br',
  '7624285894': 'ronaldo@brkarantes.com.br',
  '24864476870': 'rubens@brkarantes.com.br',
  '37832096845': 'salatiel@brkarantes.com.br',
  '16218627802': 'sinomar@brkarantes.com.br',
  '31873732830': 'wellington@brkarantes.com.br',
  '27544791807': 'adriana@chokdistribuidora.com.br',
  '26837829858': 'rodrigo.previatto@chokdistribuidora.com.br',
  '38419959855': 'ana.gotardo@chokdistribuidora.com.br',
  '27713341862': 'anderson.tofoli@chokdistribuidora.com.br',
  '35333019827': 'andrebiordo@chokdistribuidora.com.br',
  '41868265870': 'andressa@chokdistribuidora.com.br',
  '36596796825': 'bruno.santana@chokdistribuidora.com.br',
  '4370489857': 'emanuel.martins@chokdistribuidora.com.br',
  '42812196840': 'estefane.souza@chokdistribuidora.com.br',
  '34626950884': 'fabio@chokdistribuidora.com.br',
  '33238427822': 'henrique.oliveira@chokdistribuidora.com.br',
  '21879659883': 'jean@chokdistribuidora.com.br',
  '22514261830': 'joaojunior@chokdistribuidora.com.br',
  '22849500860': 'juber.villar@chokdistribuidora.com.br',
  '42892250803': 'larissa.dias@chokdistribuidora.com.br',
  '46676778807': 'laura.barbosa@chokdistribuidora.com.br',
  '40446110841': 'lays.magni@chokdistribuidora.com.br',
  '42209509823': 'leticia.bessa@chokdistribuidora.com.br',
  '6687541846': 'marco.bressan@chokdistribuidora.com.br',
  '14149928827': 'paulo.oliveira@chokdistribuidora.com.br',
  '40757711804': 'rafael.silva@chokdistribuidora.com.br',
  '36230214822': 'renato.basso@chokdistribuidora.com.br',
  '29146584862': 'rogerio.moraes@chokdistribuidora.com.br',
  '97986690020': 'samuel.silveira@chokdistribuidora.com.br',
  '11010833600': 'silmara.silva@chokdistribuidora.com.br',
  '38635293835': 'ulisses.silva@chokdistribuidora.com.br',
  '9905662855': 'vanderlei.parada@chokdistribuidora.com.br',
  '39004383824': 'vanderson@chokdistribuidora.com.br',
  '39238974802': 'wesley@chokdistribuidora.com.br',
  '31819157857': 'amilcar.ornellas@g4distribuidora.com.br',
  '22140771893': 'carlos.lopes@g4distribuidora.com.br',
  '3905518643': 'cesar.moraes@g4distribuidora.com.br',
  '12092805827': 'eduardo.rodrigues@g4distribuidora.com.br',
  '32365215890': 'leonardo.faria@g4distribuidora.com.br',
  '48949527855': 'ludmila.damico@g4distribuidora.com.br',
  '38967156820': 'rafael.amaral@g4distribuidora.com.br',
  '35012709845': 'richard.evangelista@g4distribuidora.com.br',
  '11505892805': 'junior.corazza@g4distribuidora.com.br',
  '21373623845': 'rodrigo.silva@g4distribuidora.com.br',
  '41823840833': 'tauana.moroti@g4distribuidora.com.br',
  '44344025873': 'thiago.dias@g4distribuidora.com.br',
  '39473160895': 'thiago.torres@g4distribuidora.com.br',
  '35873984883': 'tiago.aliberte@g4distribuidora.com.br',
  '46700167841': 'vinicius.faleiros@g4distribuidora.com.br',
  '23106564881': 'wellington.santos@g4distribuidora.com.br',
  '31725725878': 'willians.denver@g4distribuidora.com.br',
  '32431548805': 'aldana@grupoarantes.emp.br',
  '42772038840': 'brenda.ramos@grupoarantes.emp.br',
  '19961933842': 'dias@grupoarantes.emp.br',
  '23354502800': 'felipe.silva@grupoarantes.emp.br',
  '7177865870': 'gilberto.mezadri@chokdistribuidora.com.br',
  '34396303823': 'laila.cintra@chokdistribuidora.com.br',
  '28356928869': 'leandro.hirano@grupoarantes.emp.br',
  '10409457671': 'paulo.carrijo@grupoarantes.emp.br',
  '37059178899': 'juridico@grupoarantes.emp.br',
  '35235761804': 'taciane.picoli@grupoarantes.emp.br',
  '35755389802': 'william.cintra@grupoarantes.emp.br',
  '22967833843': 'allan.oliveira@chokdoce.com.br',
  '32689787890': 'ana.ferreira@chokdoce.com.br',
  '37966532860': 'andressa.ferreira@chokdoce.com.br',
  '3943999866': 'antonio.pereira@chokdoce.com.br',
  '43693583889': 'bruno.ramos@chokdoce.com.br',
  '38101264892': 'diego.domiciano@chokdoce.com.br',
  '37286003852': 'fabianoarantes@grupoarantes.emp.br',
  '37265766814': 'izabella.costa@grupoarantes.emp.br',
  '31181487803': 'josiel.silva@chokdoce.com.br',
  '33089440814': 'leandro.zoneti@chokdoce.com.br',
  '16219921879': 'lecilvano.alves@chokdoce.com.br',
  '10357774604': 'sabrina.reis@chokdoce.com.br',
  '33781619818': 'dinea@brkarantes.com.br',
  '49131848818': 'emilly.voltolini@grupoarantes.emp.br',
  '46448333800': 'joao.lacerda@grupoarantes.emp.br',
  '46382499811': 'klara.silva@grupoarantes.emp.br',
  '40743808894': 'philipe.pacheco@grupoarantes.emp.br',
  '35997151816': 'welder.galvani@grupoarantes.emp.br',
};

function getEmailByCpf(cpf: string | undefined): string | undefined {
  if (!cpf) return undefined;
  const normalizedCpf = cpf.replace(/\D/g, '').replace(/^0+/, '');
  return cpfEmailMap[normalizedCpf] || cpfEmailMap[cpf.replace(/\D/g, '')];
}

interface SyncRequest {
  company_external_id: string;
  source_system?: string;
  employees: EmployeeRecord[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = new Date();
  console.log(`[sync-employees] Starting sync at ${startTime.toISOString()}`);

  try {
    const apiKey = req.headers.get('x-api-key');
    const expectedApiKey = Deno.env.get('SYNC_API_KEY');

    if (!apiKey || apiKey !== expectedApiKey) {
      console.error('[sync-employees] Invalid or missing API key');
      return new Response(
        JSON.stringify({ error: 'Invalid or missing API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SyncRequest = await req.json();
    const sourceSystem = body.source_system || 'gestao_ativos';
    console.log(`[sync-employees] Received ${body.employees?.length || 0} records from ${sourceSystem}`);

    if (!body.company_external_id || !body.employees || !Array.isArray(body.employees)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body. Required: company_external_id, employees[]' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('external_id', body.company_external_id)
      .maybeSingle();

    if (companyError || !company) {
      console.error('[sync-employees] Company not found:', body.company_external_id);
      return new Response(
        JSON.stringify({ error: `Company not found: ${body.company_external_id}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const companyId = company.id;

    const { data: syncLog } = await supabase
      .from('sync_logs')
      .insert({
        company_id: companyId,
        sync_type: 'employees',
        records_received: body.employees.length,
        status: 'running'
      })
      .select()
      .single();

    let created = 0, updated = 0, failed = 0;
    const errors: any[] = [];
    const processedEmployees: Array<{ externalId: string; id: string }> = [];

    // Primeira passada: inserir/atualizar funcionários
    for (const emp of body.employees) {
      try {
        const externalId = emp.id || emp.external_id;
        const fullName = emp.nome || emp.full_name;
        const position = emp.cargo || emp.position;
        const department = emp.departamento || emp.department;
        const cpf = emp.cpf;
        const unidade = emp.unidade;
        const codVendedor = emp.cod_vendedor;
        const isCondutor = emp.is_condutor || false;
        
        // Campos CNH
        const cnhNumero = emp.cnh_numero;
        const cnhCategoria = emp.cnh_categoria;
        const cnhValidade = emp.cnh_validade;

        let isActive = true;
        if (emp.status !== undefined) {
          isActive = emp.status.toLowerCase() === 'ativo';
        } else if (emp.is_active !== undefined) {
          isActive = emp.is_active;
        }

        if (!externalId || !fullName) {
          throw new Error('Missing required fields: id/external_id and nome/full_name');
        }

        const { data: existingEmployee } = await supabase
          .from('external_employees')
          .select('id')
          .eq('company_id', companyId)
          .eq('external_id', externalId)
          .eq('source_system', sourceSystem)
          .maybeSingle();

        const cpfSource = cpf || emp.registration_number || externalId;
        const resolvedEmail = emp.email || getEmailByCpf(cpfSource);

        const employeeData = {
          company_id: companyId,
          external_id: externalId,
          source_system: sourceSystem,
          full_name: fullName,
          email: resolvedEmail || null,
          phone: emp.phone || null,
          department: department || null,
          position: position || null,
          cpf: cpf || null,
          unidade: unidade || null,
          is_condutor: isCondutor,
          cod_vendedor: codVendedor || null,
          registration_number: emp.registration_number || cpf || null,
          hire_date: emp.hire_date || null,
          is_active: isActive,
          metadata: emp.metadata || null,
          synced_at: new Date().toISOString(),
          // Campos CNH
          cnh_numero: cnhNumero || null,
          cnh_categoria: cnhCategoria || null,
          cnh_validade: cnhValidade || null
        };

        let employeeId: string;

        if (existingEmployee) {
          const { data: updatedEmp, error: updateError } = await supabase
            .from('external_employees')
            .update({ ...employeeData, updated_at: new Date().toISOString() })
            .eq('id', existingEmployee.id)
            .select('id')
            .single();

          if (updateError) throw updateError;
          updated++;
          employeeId = updatedEmp.id;
        } else {
          const { data: newEmp, error: insertError } = await supabase
            .from('external_employees')
            .insert(employeeData)
            .select('id')
            .single();

          if (insertError) throw insertError;
          created++;
          employeeId = newEmp.id;
        }

        processedEmployees.push({ externalId, id: employeeId });
      } catch (error) {
        failed++;
        errors.push({ external_id: emp.id || emp.external_id, error: String(error) });
        console.error(`[sync-employees] Error:`, error);
      }
    }

    // Segunda passada: mapear lider_direto_id
    for (const emp of body.employees) {
      const liderExternalId = emp.lider_direto_id;
      if (!liderExternalId) continue;

      const externalId = emp.id || emp.external_id;
      const employee = processedEmployees.find(e => e.externalId === externalId);
      const leader = processedEmployees.find(e => e.externalId === liderExternalId);

      if (employee && leader) {
        await supabase
          .from('external_employees')
          .update({ lider_direto_id: leader.id })
          .eq('id', employee.id);
      }
    }

    const endTime = new Date();

    if (syncLog) {
      await supabase
        .from('sync_logs')
        .update({
          records_created: created,
          records_updated: updated,
          records_failed: failed,
          errors: errors.length > 0 ? errors : null,
          completed_at: endTime.toISOString(),
          status: failed > 0 ? 'partial' : 'success'
        })
        .eq('id', syncLog.id);
    }

    return new Response(
      JSON.stringify({ success: true, created, updated, failed, errors: errors.length > 0 ? errors : undefined }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-employees] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
