import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from '../_shared/cors.ts'

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
  
  // NOVO: Identificação da empresa por CNPJ
  cnpj_empresa?: string;
  
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

  // Campos de líder direto via CPF (API DAB)
  CPF_Lider?: string | null;
  Nome_Lider?: string | null;
  cpf_lider?: string | null;
  nome_lider?: string | null;

  // Formato bruto da API DAB
  Situacao?: number | string | null;
  CPF?: string | null;
  Nome_Funcionario?: string | null;
  Email?: string | null;
  Sexo?: string | null;
  Data_Nascimento?: string | null;
  Idade?: number | string | null;
  Data_Admissao?: string | null;
  Data_Demissao?: string | null;
  Primeiro_Emprego?: string | null;
  Contabilizacao?: string | null;
  Cargo?: string | null;
  Categoria?: string | null;
  Departamento?: string | null;
  Funcao?: string | null;
  Cod_Empresa?: number | string | null;
  Nome_Fantasia?: string | null;
  id_funcionario?: string | null;
  nome_funcionario?: string | null;
  data_admissao?: string | null;
  data_demissao?: string | null;
  nome_fantasia?: string | null;
  cod_empresa?: number | string | null;
  primeiro_emprego?: string | null;
  contabilizacao?: string | null;
  data_nascimento?: string | null;
  situacao_raw?: number | string | null;
  funcao?: string | null;
  categoria?: string | null;
  sexo?: string | null;
  idade?: number | string | null;
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

function normalizeCnpj(cnpj: string | undefined): string | undefined {
  if (!cnpj) return undefined;
  return cnpj.replace(/\D/g, '');
}

function normalizeCpf(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\D/g, '');
  return normalized || undefined;
}

function normalizeSituacao(value: number | string | boolean | null | undefined): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 0 || value === '0') return false;
  if (value === 1 || value === '1') return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'ativo') return true;
    if (normalized === 'inativo') return false;
  }
  return true;
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // ISO format: "2026-03-15T00:00:00..." → "2026-03-15"
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) return trimmed.substring(0, 10);
  // BR format: "15/03/2026" → "2026-03-15"
  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  return null;
}

function normalizeEmployeeRecord(emp: EmployeeRecord): EmployeeRecord {
  const cpf = normalizeCpf(emp.cpf ?? emp.CPF);
  const externalId = emp.id || emp.external_id || emp.id_funcionario || cpf;
  const fullName = emp.nome || emp.full_name || emp.nome_funcionario || emp.Nome_Funcionario || undefined;

  return {
    ...emp,
    id: externalId,
    external_id: externalId,
    nome: fullName,
    full_name: fullName,
    cpf,
    email: emp.email ?? emp.Email ?? undefined,
    cargo: emp.cargo ?? emp.Cargo ?? undefined,
    position: emp.position ?? emp.cargo ?? emp.Cargo ?? undefined,
    departamento: emp.departamento ?? emp.Departamento ?? undefined,
    department: emp.department ?? emp.departamento ?? emp.Departamento ?? undefined,
    unidade: emp.unidade ?? emp.Nome_Fantasia ?? emp.nome_fantasia ?? undefined,
    hire_date: emp.hire_date ?? emp.data_admissao ?? emp.Data_Admissao ?? undefined,
    is_active: emp.is_active ?? normalizeSituacao(emp.situacao_raw ?? emp.Situacao ?? emp.status),
    metadata: {
      ...(emp.metadata || {}),
      function_name: emp.funcao ?? emp.Funcao ?? null,
      categoria: emp.categoria ?? emp.Categoria ?? null,
      company_code: emp.cod_empresa ?? emp.Cod_Empresa ?? null,
      company_name: emp.nome_fantasia ?? emp.Nome_Fantasia ?? null,
      contabilizacao_raw: emp.contabilizacao ?? emp.Contabilizacao ?? null,
      dismissal_date: emp.data_demissao ?? emp.Data_Demissao ?? null,
      situacao_raw: emp.situacao_raw ?? emp.Situacao ?? null,
      sexo_raw: emp.sexo ?? emp.Sexo ?? null,
      primeiro_emprego_raw: emp.primeiro_emprego ?? emp.Primeiro_Emprego ?? null,
      idade_raw: emp.idade ?? emp.Idade ?? null,
    },
  };
}

interface SyncRequest {
  company_external_id?: string; // Agora OPCIONAL (fallback)
  source_system?: string;
  employees?: EmployeeRecord[];
  value?: EmployeeRecord[];
}

interface CompanyStats {
  created: number;
  updated: number;
  failed: number;
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const startTime = new Date();
  console.log(`[sync-employees] Starting sync at ${startTime.toISOString()}`);

  try {
    const apiKey = req.headers.get('x-api-key');
    const expectedApiKey = Deno.env.get('SYNC_API_KEY');

    if (!apiKey || apiKey !== expectedApiKey) {
      console.error('[sync-employees] Invalid or missing API key');
      return new Response(
        JSON.stringify({ error: 'Invalid or missing API key' }),
        { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SyncRequest = await req.json();
    const employeesPayload = Array.isArray(body.employees)
      ? body.employees
      : Array.isArray(body.value)
        ? body.value
        : null;
    const sourceSystem = body.source_system || 'gestao_ativos';
    const globalCompanyExternalId = body.company_external_id;
    const syncTimestamp = new Date().toISOString();

    console.log(`[sync-employees] Received ${employeesPayload?.length || 0} records from ${sourceSystem}`);
    console.log(`[sync-employees] Global company_external_id: ${globalCompanyExternalId || 'not provided'}`);

    if (!employeesPayload) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body. Required: employees[] or value[]' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmployees = employeesPayload.map((emp) => normalizeEmployeeRecord(emp));

    // Carregar todas as empresas para criar mapa CNPJ → ID
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, external_id, name');

    if (companiesError) {
      console.error('[sync-employees] Error loading companies:', companiesError);
      return new Response(
        JSON.stringify({ error: 'Failed to load companies' }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Criar mapa CNPJ → ID (normalizado)
    const companyMap = new Map<string, string>();
    const companyNameMap = new Map<string, string>();
    
    for (const company of companies || []) {
      if (company.external_id) {
        const normalizedCnpj = normalizeCnpj(company.external_id);
        if (normalizedCnpj) {
          companyMap.set(normalizedCnpj, company.id);
          companyNameMap.set(normalizedCnpj, company.name);
        }
      }
    }
    
    console.log(`[sync-employees] Loaded ${companyMap.size} companies into cache`);

    // Identificar CNPJs únicos no payload
    const uniqueCnpjs = new Set<string>();
    for (const emp of normalizedEmployees) {
      const cnpj = normalizeCnpj(emp.cnpj_empresa);
      if (cnpj) uniqueCnpjs.add(cnpj);
    }
    console.log(`[sync-employees] Identified ${uniqueCnpjs.size} unique companies in payload`);

    // Fallback company ID (se fornecido global)
    let fallbackCompanyId: string | null = null;
    if (globalCompanyExternalId) {
      const normalizedFallback = normalizeCnpj(globalCompanyExternalId);
      if (normalizedFallback) {
        fallbackCompanyId = companyMap.get(normalizedFallback) || null;
        if (!fallbackCompanyId) {
          console.warn(`[sync-employees] Fallback company not found: ${globalCompanyExternalId}`);
        }
      }
    }

    // Estatísticas globais e por empresa
    let totalCreated = 0, totalUpdated = 0, totalFailed = 0;
    const byCompany: Record<string, CompanyStats> = {};
    const errors: Array<{external_id: string | undefined; cnpj_empresa: string | undefined; error: string}> = [];
    const processedEmployees: Array<{ externalId: string; id: string; cpf: string | null }> = [];

    // Inicializar estatísticas por empresa
    for (const cnpj of uniqueCnpjs) {
      byCompany[cnpj] = { created: 0, updated: 0, failed: 0 };
    }

    // Criar sync log (usando a primeira empresa ou null)
    const firstCompanyId = fallbackCompanyId || (uniqueCnpjs.size > 0 ? companyMap.get([...uniqueCnpjs][0]) : null);
    
    const { data: syncLog } = await supabase
      .from('sync_logs')
      .insert({
        company_id: firstCompanyId,
        sync_type: 'employees',
        records_received: normalizedEmployees.length,
        status: 'running'
      })
      .select()
      .single();

    // Primeira passada: inserir/atualizar funcionários
    for (const emp of normalizedEmployees) {
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

        const isActive = normalizeSituacao(emp.situacao_raw ?? emp.Situacao ?? emp.status ?? emp.is_active);

        if (!externalId || !fullName) {
          throw new Error('Missing required fields: id/external_id and nome/full_name');
        }

        // Determinar company_id baseado no cnpj_empresa ou fallback
        const empCnpj = normalizeCnpj(emp.cnpj_empresa);
        let companyId: string | null = null;
        
        if (empCnpj) {
          companyId = companyMap.get(empCnpj) || null;
          if (!companyId) {
            console.warn(`[sync-employees] Company not found for CNPJ: ${empCnpj}`);
          }
        }
        
        // Usar fallback se não encontrou pela cnpj_empresa
        if (!companyId && fallbackCompanyId) {
          companyId = fallbackCompanyId;
        }
        
        // Se ainda não tem company_id, registrar erro
        if (!companyId) {
          throw new Error(`No company found for employee. cnpj_empresa: ${emp.cnpj_empresa || 'not provided'}, fallback: ${globalCompanyExternalId || 'not provided'}`);
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

        const employeeData: Record<string, any> = {
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
          termination_date: normalizeDate(emp.data_demissao ?? emp.Data_Demissao ?? null),
          metadata: emp.metadata || null,
          synced_at: syncTimestamp,
          // Campos CNH
          cnh_numero: cnhNumero || null,
          cnh_categoria: cnhCategoria || null,
          cnh_validade: cnhValidade || null
        };

        // Se tem data de demissão, forçar inativo
        if (employeeData.termination_date) {
          employeeData.is_active = false;
        }

        let employeeId: string;

        if (existingEmployee) {
          const { data: updatedEmp, error: updateError } = await supabase
            .from('external_employees')
            .update({ ...employeeData, updated_at: new Date().toISOString() })
            .eq('id', existingEmployee.id)
            .select('id')
            .single();

          if (updateError) throw updateError;
          totalUpdated++;
          if (empCnpj && byCompany[empCnpj]) {
            byCompany[empCnpj].updated++;
          }
          employeeId = updatedEmp.id;
        } else {
          const { data: newEmp, error: insertError } = await supabase
            .from('external_employees')
            .insert(employeeData)
            .select('id')
            .single();

          if (insertError) throw insertError;
          totalCreated++;
          if (empCnpj && byCompany[empCnpj]) {
            byCompany[empCnpj].created++;
          }
          employeeId = newEmp.id;
        }

        processedEmployees.push({ externalId, id: employeeId, cpf: cpf || null });
      } catch (error) {
        totalFailed++;
        const empCnpj = normalizeCnpj(emp.cnpj_empresa);
        if (empCnpj && byCompany[empCnpj]) {
          byCompany[empCnpj].failed++;
        }
        errors.push({ external_id: emp.id || emp.external_id, cnpj_empresa: emp.cnpj_empresa, error: String(error) });
        console.error(`[sync-employees] Error:`, error);
      }
    }

    // Segunda passada: mapear lider_direto_id via CPF_Lider
    // Constrói mapa CPF normalizado → UUID (do lote atual, evita queries extras)
    const cpfToUuidMap = new Map<string, string>();
    for (const { cpf, id } of processedEmployees) {
      if (cpf) cpfToUuidMap.set(cpf.replace(/\D/g, ''), id);
    }

    for (const emp of normalizedEmployees) {
      const cpfLider = normalizeCpf(emp.CPF_Lider ?? emp.cpf_lider);
      if (!cpfLider) continue;

      const externalId = emp.id || emp.external_id;
      const employee = processedEmployees.find(e => e.externalId === externalId);
      if (!employee) continue;

      // 1. Buscar UUID do líder no lote atual (sem query extra)
      let liderUuid: string | null = cpfToUuidMap.get(cpfLider) || null;

      // 2. Fallback: buscar no banco por cpf (líder pode estar em sync anterior)
      if (!liderUuid) {
        const { data: liderData } = await supabase
          .from('external_employees')
          .select('id')
          .eq('cpf', cpfLider)
          .eq('source_system', sourceSystem)
          .maybeSingle();
        liderUuid = liderData?.id || null;
      }

      if (liderUuid) {
        await supabase
          .from('external_employees')
          .update({ lider_direto_id: liderUuid })
          .eq('id', employee.id);
      }
    }

    // === Etapa 3: Inativar funcionários ausentes ===
    let totalDeactivated = 0;
    const deactivatedByCompany: Record<string, number> = {};

    // Coletar company_ids únicos que foram processados com sucesso
    const processedCompanyIds = new Set<string>();
    const companyExternalIdsByCompany = new Map<string, Set<string>>();

    for (const emp of normalizedEmployees) {
      const externalId = emp.id || emp.external_id;
      const empCnpj = normalizeCnpj(emp.cnpj_empresa);
      let companyId: string | null = null;

      if (empCnpj) {
        companyId = companyMap.get(empCnpj) || null;
      }
      if (!companyId && fallbackCompanyId) {
        companyId = fallbackCompanyId;
      }

      if (companyId && externalId) {
        processedCompanyIds.add(companyId);
        if (!companyExternalIdsByCompany.has(companyId)) {
          companyExternalIdsByCompany.set(companyId, new Set());
        }
        companyExternalIdsByCompany.get(companyId)!.add(externalId);
      }
    }

    for (const companyId of processedCompanyIds) {
      const payloadExternalIds = companyExternalIdsByCompany.get(companyId);
      if (!payloadExternalIds || payloadExternalIds.size === 0) {
        console.log(`[sync-employees] Skipping deactivation for company ${companyId}: empty payload (safety)`);
        continue;
      }

      // Buscar todos os ativos dessa empresa/source_system
      const { data: activeInDb, error: fetchError } = await supabase
        .from('external_employees')
        .select('id, external_id')
        .eq('company_id', companyId)
        .eq('source_system', sourceSystem)
        .eq('is_active', true);

      if (fetchError) {
        console.error(`[sync-employees] Error fetching active employees for company ${companyId}:`, fetchError);
        continue;
      }

      // Identificar os que não vieram no payload
      const toDeactivate = (activeInDb || []).filter(e => !payloadExternalIds.has(e.external_id));

      if (toDeactivate.length > 0) {
        const deactivateChunks = chunkArray(toDeactivate, 250);
        for (const chunk of deactivateChunks) {
          const idsToDeactivate = chunk.map(e => e.id);

          const { error: deactivateError } = await supabase
            .from('external_employees')
            .update({ is_active: false, updated_at: new Date().toISOString(), synced_at: syncTimestamp })
            .in('id', idsToDeactivate);

          if (deactivateError) {
            console.error(`[sync-employees] Error deactivating employees for company ${companyId}:`, deactivateError);
            continue;
          }

          totalDeactivated += chunk.length;
        }

        // Registrar por CNPJ para a resposta (mantém compatibilidade do output)
        const cnpjForCompany = [...companyMap.entries()].find(([_, id]) => id === companyId)?.[0] || companyId;
        deactivatedByCompany[cnpjForCompany] = (deactivatedByCompany[cnpjForCompany] || 0) + toDeactivate.length;
        console.log(`[sync-employees] Deactivated ${toDeactivate.length} employees for company ${companyId}`);
      }
    }

    const endTime = new Date();

    // Log estatísticas por empresa
    for (const [cnpj, stats] of Object.entries(byCompany)) {
      const companyName = companyNameMap.get(cnpj) || 'Unknown';
      const deactivated = deactivatedByCompany[cnpj] || 0;
      console.log(`[sync-employees] Company ${cnpj} (${companyName}): ${stats.created} created, ${stats.updated} updated, ${stats.failed} failed, ${deactivated} deactivated`);
    }

    if (syncLog) {
      await supabase
        .from('sync_logs')
        .update({
          records_created: totalCreated,
          records_updated: totalUpdated,
          records_failed: totalFailed,
          errors: errors.length > 0 ? errors : null,
          completed_at: endTime.toISOString(),
          status: totalFailed > 0 ? 'partial' : 'success'
        })
        .eq('id', syncLog.id);
    }

    console.log(`[sync-employees] Sync completed: ${totalCreated} created, ${totalUpdated} updated, ${totalFailed} failed, ${totalDeactivated} deactivated`);

    // Adicionar deactivated nas stats por empresa
    const byCompanyWithDeactivated: Record<string, any> = {};
    for (const [cnpj, stats] of Object.entries(byCompany)) {
      byCompanyWithDeactivated[cnpj] = { ...stats, deactivated: deactivatedByCompany[cnpj] || 0 };
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        created: totalCreated, 
        updated: totalUpdated, 
        failed: totalFailed,
        deactivated: totalDeactivated,
        by_company: byCompanyWithDeactivated,
        errors: errors.length > 0 ? errors : undefined 
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-employees] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
