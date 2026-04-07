import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CalendarDays,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  Upload,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/external-client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";

interface Goal {
  id: string;
  company_id: string;
  area_id: string | null;
  title: string;
  description: string | null;
  type: "numeric" | "activity" | "hybrid";
  pillar: "FAT" | "RT" | "MS" | "SC" | "DN" | "CO" | "ESG" | null;
  unit: string | null;
  target_value: number | null;
  current_value: number;
  start_date: string | null;
  end_date: string | null;
  cadence: "monthly" | "activity" | "quarterly" | "annual" | "semester";
  status: "active" | "completed" | "paused" | "cancelled";
  indicator_type?: string | null;
  evaluation_points?: number | null;
  gamification_weight?: number | null;
  effective_value?: number | null;
  kpi_n1?: string | null;
  created_at: string;
}

interface GoalActivity {
  id: string;
  goal_id: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  weight: number;
  due_date: string | null;
  created_at: string;
}

interface GoalUpdate {
  id: string;
  goal_id: string;
  value: number;
  notes: string | null;
  updated_by: string | null;
  created_at: string;
}

interface AreaOption {
  id: string;
  name: string;
  company_id?: string | null;
}

interface CompanyOption {
  id: string;
  name: string;
}

type DynamicQueryResult<T> = Promise<{ data: T | null; error: { message?: string } | null }>;

interface DynamicTableQuery<T> {
  select: (columns: string) => DynamicTableQuery<T>;
  insert: (values: unknown) => DynamicTableQuery<T>;
  update: (values: unknown) => DynamicTableQuery<T>;
  delete: () => DynamicTableQuery<T>;
  eq: (column: string, value: unknown) => DynamicTableQuery<T>;
  order: (column: string, options?: { ascending?: boolean }) => DynamicTableQuery<T>;
  limit: (count: number) => DynamicTableQuery<T>;
  single: () => DynamicQueryResult<T>;
  then: PromiseLike<{ data: T | null; error: { message?: string } | null }>["then"];
}

interface DynamicSupabaseClient {
  from: <T = unknown>(table: string) => DynamicTableQuery<T>;
}

type GoalFormData = {
  title: string;
  description: string;
  type: Goal["type"];
  pillar: NonNullable<Goal["pillar"]> | "none";
  unit: string;
  target_value: string;
  current_value: string;
  start_date: string;
  end_date: string;
  cadence: Goal["cadence"];
  status: Goal["status"];
  area_id: string;
  gamification_weight: string;
};

const defaultGoalFormData: GoalFormData = {
  title: "",
  description: "",
  type: "numeric",
  pillar: "none",
  unit: "",
  target_value: "",
  current_value: "0",
  start_date: "",
  end_date: "",
  cadence: "monthly",
  status: "active",
  area_id: "none",
  gamification_weight: "1",
};

const statusLabel: Record<Goal["status"], string> = {
  active: "Ativa",
  completed: "Concluída",
  paused: "Pausada",
  cancelled: "Cancelada",
};

const typeLabel: Record<Goal["type"], string> = {
  numeric: "Numérica",
  activity: "Atividade",
  hybrid: "Híbrida",
};

const activityStatusLabel: Record<GoalActivity["status"], string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
};

const formatDate = (value: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
};

const formatWeight = (value: number | null | undefined) => {
  if (value == null) return "—";
  return Number.isInteger(value) ? String(value) : value.toLocaleString("pt-BR");
};

const cadenceLabel: Record<Goal["cadence"], string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  semester: "Semestral",
  annual: "Anual",
  activity: "Atividade",
};

const indicatorBadgeClass: Record<string, string> = {
  PROJETO: "bg-blue-500/15 text-blue-600 border-blue-500/40",
  PROCESSO: "bg-amber-500/15 text-amber-600 border-amber-500/40",
  PERFORMANCE: "bg-emerald-500/15 text-emerald-600 border-emerald-500/40",
};

const pillarLabel: Record<NonNullable<Goal["pillar"]>, string> = {
  FAT: "Faturamento",
  RT: "Rentabilidade",
  CO: "Clima Org.",
  MS: "Market Share",
  SC: "Satisfação Cliente",
  DN: "Distribuição Num.",
  ESG: "ESG",
};

const computeGoalPoints = (goal: Goal) => {
  const weight = goal.gamification_weight ?? 1;
  const evalPoints = goal.evaluation_points;
  if (evalPoints != null && evalPoints > 0) {
    return {
      responsible: Math.round(evalPoints * weight),
      creator: Math.round(evalPoints * 0.4 * weight),
      basis: `${evalPoints} × peso ${formatWeight(weight)}`,
    };
  }
  return {
    responsible: Math.round(50 * weight),
    creator: Math.round(20 * weight),
    basis: `Fallback legacy (peso ${formatWeight(weight)})`,
  };
};

type ImportFormat = "legacy" | "pe2026";

type ImportRow = Record<string, string>;

const LEGACY_REQUIRED_HEADERS = [
  "EMPRESA",
  "ÁREA / DEPARTAMENTO",
  "TIPO INDICADOR",
  "PILAR ESTRATÉGICO",
  "KPI",
  "META",
  "PONTOS POR AVALIAÇÃO",
  "FRENQUENCIA AVALIAÇÃO",
  "EFETIVO",
] as const;

const PE2026_REQUIRED_HEADERS = [
  "EMPRESA",
  "ÁREA",
  "INDICADOR",
  "PILAR",
  "KPI (N1)",
  "AÇÃO",
  "PONTOS POR AVALIACAO",
  "FREQUENCIA AVALIAÇÃO",
] as const;

interface ImportPreviewRow {
  rowNumber: number;
  raw: ImportRow;
  format: ImportFormat;
  companyId: string | null;
  companyName: string | null;
  areaId: string | null;
  areaName: string | null;
  title: string;
  kpiN1: string | null;
  description: string | null;
  goalType: Goal["type"];
  cadence: Goal["cadence"];
  pillar: Goal["pillar"];
  indicatorType: string | null;
  targetValue: number | null;
  currentValue: number;
  evaluationPoints: number | null;
  effectiveValue: number | null;
  errors: string[];
}

function detectImportFormat(headers: string[]): ImportFormat {
  const norm = headers.map((h) => h.trim().toUpperCase());
  if (norm.includes("KPI (N1)") && norm.includes("AÇÃO")) return "pe2026";
  return "legacy";
}

function getRequiredHeaders(format: ImportFormat): readonly string[] {
  return format === "pe2026" ? PE2026_REQUIRED_HEADERS : LEGACY_REQUIRED_HEADERS;
}

function normalizeImportText(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function parseImportNumber(value: string | null | undefined): number | null {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const normalized = raw
    .replace(/\s/g, "")
    .replace(/[^0-9,.-]/g, "");

  if (!normalized) return null;

  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");
  const numberText = hasComma && hasDot
    ? normalized.replace(/\./g, "").replace(",", ".")
    : hasComma
      ? normalized.replace(",", ".")
      : normalized;

  const parsed = Number(numberText);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapImportCadence(value: string): Goal["cadence"] {
  const normalized = normalizeImportText(value);
  if (normalized.includes("trimes")) return "quarterly";
  if (normalized.includes("semestr")) return "semester";
  if (normalized.includes("anual")) return "annual";
  if (normalized.includes("atividade")) return "activity";
  return "monthly";
}

function mapImportGoalType(value: string): Goal["type"] {
  const normalized = normalizeImportText(value);
  if (normalized.includes("process")) return "activity";
  if (normalized.includes("performance")) return "numeric";
  if (normalized.includes("projet")) return "numeric";
  return "hybrid";
}

function mapImportPillar(value: string): Goal["pillar"] {
  const normalized = normalizeImportText(value);
  if (normalized.includes("(fat)") || normalized === "fat") return "FAT";
  if (normalized.includes("(rt)") || normalized === "rt") return "RT";
  if (normalized.includes("(ms)") || normalized === "ms") return "MS";
  if (normalized.includes("(sc)") || normalized === "sc") return "SC";
  if (normalized.includes("(dn)") || normalized === "dn") return "DN";
  if (normalized.includes("(co)") || normalized === "co") return "CO";
  if (normalized.includes("esg")) return "ESG";
  return null;
}

function splitCsvLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values.map((item) => item.replace(/^"|"$/g, "").trim());
}

function detectCsvDelimiter(headerLine: string) {
  const semicolons = (headerLine.match(/;/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;
  return semicolons >= commas ? ";" : ",";
}

export default function Metas() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { checkPermission, user } = useAuth();
  const { selectedCompanyId } = useCompany();
  const db = supabase as unknown as DynamicSupabaseClient;

  const canCreate = checkPermission("metas", "create");
  const canEdit = checkPermission("metas", "edit");
  const canDelete = checkPermission("metas", "delete");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pillarFilter, setPillarFilter] = useState<string>("all");
  const [indicatorFilter, setIndicatorFilter] = useState<string>("all");
  const [definedFilter, setDefinedFilter] = useState<string>("all");
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [goalFormData, setGoalFormData] = useState<GoalFormData>(defaultGoalFormData);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreviewRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSummary, setImportSummary] = useState<{
    totalRows: number;
    validRows: number;
    invalidRows: number;
  } | null>(null);

  const [progressValue, setProgressValue] = useState("0");

  const [activityTitle, setActivityTitle] = useState("");
  const [activityDescription, setActivityDescription] = useState("");
  const [activityWeight, setActivityWeight] = useState("1");
  const [activityDueDate, setActivityDueDate] = useState("");

  const goalsKey = ["metas", "goals", selectedCompanyId] as const;
  const areasKey = ["metas", "areas", selectedCompanyId] as const;
  const activitiesKey = ["metas", "activities", selectedGoalId] as const;
  const updatesKey = ["metas", "updates", selectedGoalId] as const;

  const companiesQuery = useQuery({
    queryKey: ["metas", "companies"],
    queryFn: async () => {
      const { data, error } = await db
        .from<CompanyOption[]>("companies")
        .select("id, name")
        .order("name", { ascending: true });

      if (error) throw error;
      return (data || []) as CompanyOption[];
    },
  });

  const areasQuery = useQuery({
    queryKey: areasKey,
    queryFn: async () => {
      let query = db
        .from("areas")
        .select("id, name, company_id")
        .order("name", { ascending: true });

      if (selectedCompanyId) {
        query = query.eq("company_id", selectedCompanyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AreaOption[];
    },
  });

  const goalsQuery = useQuery({
    queryKey: goalsKey,
    queryFn: async () => {
      let query = db
        .from<Goal[]>("goals")
        .select(
          "id, company_id, area_id, title, description, type, pillar, unit, target_value, current_value, start_date, end_date, cadence, status, indicator_type, evaluation_points, gamification_weight, effective_value, kpi_n1, created_at"
        )
        .order("created_at", { ascending: false });

      if (selectedCompanyId) {
        query = query.eq("company_id", selectedCompanyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Goal[];
    },
  });

  // Summary de gamificação do usuário (pontos via metas + nivel)
  const gamificationSummaryQuery = useQuery({
    queryKey: ["metas", "gamification-summary", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [pointsRes, userPointsRes] = await Promise.all([
        db
          .from<Array<{ points: number; action_type: string }>>("points_history")
          .select("points, action_type")
          .eq("user_id", user!.id),
        db
          .from<{ total_points_earned: number; level: number; points: number }>("user_points")
          .select("total_points_earned, level, points")
          .eq("user_id", user!.id)
          .single(),
      ]);
      const history = (pointsRes.data || []) as Array<{ points: number; action_type: string }>;
      const goalPoints = history
        .filter((h) => h.action_type === "goal_achieved" || h.action_type === "goal_achieved_team")
        .reduce((sum, h) => sum + (h.points || 0), 0);
      const goalCount = history.filter(
        (h) => h.action_type === "goal_achieved" || h.action_type === "goal_achieved_team"
      ).length;
      const userPoints = (userPointsRes.data || null) as
        | { total_points_earned: number; level: number; points: number }
        | null;
      const level = userPoints?.level ?? 1;
      const totalPts = userPoints?.total_points_earned ?? 0;
      const nextLevelPts = level * level * 100;
      return {
        goalPoints,
        goalCount,
        totalPoints: totalPts,
        level,
        nextLevelPts,
        ptsToNext: Math.max(nextLevelPts - totalPts, 0),
      };
    },
  });

  const selectedGoal = useMemo(
    () => (goalsQuery.data || []).find((goal) => goal.id === selectedGoalId) || null,
    [goalsQuery.data, selectedGoalId]
  );

  const areaNameMap = useMemo(
    () => new Map((areasQuery.data || []).map((area) => [area.id, area.name])),
    [areasQuery.data]
  );

  const companyByNameMap = useMemo(
    () =>
      new Map(
        (companiesQuery.data || []).map((company) => [normalizeImportText(company.name), company])
      ),
    [companiesQuery.data]
  );

  const areaByCompanyAndNameMap = useMemo(() => {
    const map = new Map<string, AreaOption>();
    for (const area of areasQuery.data || []) {
      const key = `${area.company_id || "global"}|${normalizeImportText(area.name)}`;
      map.set(key, area);
    }
    return map;
  }, [areasQuery.data]);

  const filteredGoals = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return (goalsQuery.data || []).filter((goal) => {
      const statusMatch = statusFilter === "all" || goal.status === statusFilter;
      const pillarMatch = pillarFilter === "all" || goal.pillar === pillarFilter;
      const indicatorMatch =
        indicatorFilter === "all" || (goal.indicator_type ?? "").toUpperCase() === indicatorFilter;
      const definedMatch =
        definedFilter === "all" ||
        (definedFilter === "defined" && goal.target_value !== null) ||
        (definedFilter === "todefine" && goal.target_value === null);
      const searchMatch =
        term.length === 0 ||
        goal.title.toLowerCase().includes(term) ||
        (goal.description ?? "").toLowerCase().includes(term) ||
        (goal.kpi_n1 ?? "").toLowerCase().includes(term);

      return statusMatch && pillarMatch && indicatorMatch && definedMatch && searchMatch;
    });
  }, [goalsQuery.data, searchTerm, statusFilter, pillarFilter, indicatorFilter, definedFilter]);

  // Agrupar por ÁREA → INDICADOR → metas
  const groupedByArea = useMemo(() => {
    type IndicatorGroup = { indicator: string; goals: Goal[] };
    type AreaGroup = { areaId: string | null; areaName: string; indicators: IndicatorGroup[]; total: number };

    const map = new Map<string, AreaGroup>();
    for (const goal of filteredGoals) {
      const areaKey = goal.area_id ?? "__none__";
      const areaName = goal.area_id ? areaNameMap.get(goal.area_id) ?? "Sem área" : "Sem área";
      let group = map.get(areaKey);
      if (!group) {
        group = { areaId: goal.area_id, areaName, indicators: [], total: 0 };
        map.set(areaKey, group);
      }
      const indicator = (goal.indicator_type ?? "OUTROS").toUpperCase();
      let indicatorGroup = group.indicators.find((g) => g.indicator === indicator);
      if (!indicatorGroup) {
        indicatorGroup = { indicator, goals: [] };
        group.indicators.push(indicatorGroup);
      }
      indicatorGroup.goals.push(goal);
      group.total += 1;
    }
    // Ordenar áreas alfabeticamente, indicadores em ordem fixa
    const indicatorOrder = ["PROJETO", "PERFORMANCE", "PROCESSO", "OUTROS"];
    return Array.from(map.values())
      .sort((a, b) => a.areaName.localeCompare(b.areaName))
      .map((area) => ({
        ...area,
        indicators: area.indicators.sort(
          (a, b) => indicatorOrder.indexOf(a.indicator) - indicatorOrder.indexOf(b.indicator)
        ),
      }));
  }, [filteredGoals, areaNameMap]);

  const closeImportDialog = () => {
    setImportDialogOpen(false);
    setImportFileName("");
    setImportPreview([]);
    setImportErrors([]);
    setImportSummary(null);
  };

  const buildImportPreview = (rows: ImportRow[], format: ImportFormat) => {
    const previewRows: ImportPreviewRow[] = rows.map((row, index) => {
      const errors: string[] = [];
      const isPe2026 = format === "pe2026";

      // Mapeamento de campos por formato
      const companyNameRaw = row["EMPRESA"] || "";
      const areaNameRaw = isPe2026 ? row["ÁREA"] || "" : row["ÁREA / DEPARTAMENTO"] || "";
      const indicatorRaw = isPe2026 ? row["INDICADOR"] || "" : row["TIPO INDICADOR"] || "";
      const pilarRaw = isPe2026 ? row["PILAR"] || "" : row["PILAR ESTRATÉGICO"] || "";
      const cadenceRaw = isPe2026 ? row["FREQUENCIA AVALIAÇÃO"] || "" : row["FRENQUENCIA AVALIAÇÃO"] || "";
      const evalPointsRaw = isPe2026 ? row["PONTOS POR AVALIACAO"] || "" : row["PONTOS POR AVALIAÇÃO"] || "";

      // Title vem de AÇÃO (PE2026) ou KPI (legacy)
      const title = isPe2026 ? (row["AÇÃO"] || "").trim() : (row["KPI"] || "").trim();
      // KPI N1 é categoria — só existe no formato novo
      const kpiN1 = isPe2026 ? (row["KPI (N1)"] || "").trim() || null : null;
      // Description vem de OBSERVAÇÃO DA META (PE2026) ou é construída (legacy)
      const observation = isPe2026 ? (row["OBSERVAÇÃO DA META"] || "").trim() : "";

      const company =
        companyByNameMap.get(normalizeImportText(companyNameRaw)) ||
        (selectedCompanyId
          ? (companiesQuery.data || []).find((entry) => entry.id === selectedCompanyId) || null
          : null);

      if (!company) errors.push(`Empresa "${companyNameRaw}" não encontrada`);
      if (!title) errors.push(isPe2026 ? "AÇÃO obrigatória" : "KPI obrigatório");

      const area =
        company && areaNameRaw.trim()
          ? areaByCompanyAndNameMap.get(`${company.id}|${normalizeImportText(areaNameRaw)}`) || null
          : null;

      if (areaNameRaw.trim() && !area) {
        errors.push(`Área "${areaNameRaw}" não cadastrada para esta empresa`);
      }

      // META vem vazia no PE2026 — não bloquear
      const targetValue = parseImportNumber(row["META"]);
      const currentValue = parseImportNumber(row["EFETIVO"]) ?? 0;
      const evaluationPoints = parseImportNumber(evalPointsRaw);
      const effectiveValue = parseImportNumber(row["EFETIVO"]);

      // Description final
      const description = isPe2026
        ? observation || null
        : ([
            indicatorRaw ? `Tipo indicador: ${indicatorRaw}` : null,
            pilarRaw ? `Pilar original: ${pilarRaw}` : null,
            areaNameRaw ? `Área/Departamento origem: ${areaNameRaw}` : null,
          ]
            .filter(Boolean)
            .join(" | ") || null);

      return {
        rowNumber: index + 2,
        raw: row,
        format,
        companyId: company?.id || null,
        companyName: company?.name || null,
        areaId: area?.id || null,
        areaName: area?.name || null,
        title,
        kpiN1,
        description,
        goalType: mapImportGoalType(indicatorRaw),
        cadence: mapImportCadence(cadenceRaw),
        pillar: mapImportPillar(pilarRaw),
        indicatorType: indicatorRaw.trim() ? indicatorRaw.trim().toUpperCase() : null,
        targetValue,
        currentValue,
        evaluationPoints,
        effectiveValue,
        errors,
      };
    });

    setImportPreview(previewRows);
    setImportErrors(previewRows.flatMap((row) => row.errors.map((error) => `Linha ${row.rowNumber}: ${error}`)));
    setImportSummary({
      totalRows: previewRows.length,
      validRows: previewRows.filter((row) => row.errors.length === 0).length,
      invalidRows: previewRows.filter((row) => row.errors.length > 0).length,
    });
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const lines = text
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0);

      if (lines.length < 2) {
        throw new Error("O arquivo precisa ter cabeçalho e pelo menos uma linha de dados.");
      }

      const delimiter = detectCsvDelimiter(lines[0]);
      const headers = splitCsvLine(lines[0], delimiter);
      const format = detectImportFormat(headers);
      const requiredHeaders = getRequiredHeaders(format);
      const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));

      if (missingHeaders.length > 0) {
        throw new Error(
          `Cabeçalhos ausentes (formato ${format === "pe2026" ? "PE 2026" : "legacy"}): ${missingHeaders.join(", ")}`
        );
      }

      // Constrói rows preservando todos os headers presentes (não só os obrigatórios)
      const rows: ImportRow[] = lines.slice(1).map((line) => {
        const values = splitCsvLine(line, delimiter);
        const row: ImportRow = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || "";
        });
        return row;
      });

      setImportFileName(file.name);
      buildImportPreview(rows, format);
    } catch (error) {
      setImportFileName(file.name);
      setImportPreview([]);
      setImportSummary(null);
      setImportErrors([error instanceof Error ? error.message : "Falha ao ler o arquivo de importação."]);
    }
  };

  const activitiesQuery = useQuery({
    queryKey: activitiesKey,
    enabled: !!selectedGoalId,
    queryFn: async () => {
      const { data, error } = await db
        .from<GoalActivity[]>("goal_activities")
        .select("id, goal_id, title, description, status, weight, due_date, created_at")
        .eq("goal_id", selectedGoalId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as GoalActivity[];
    },
  });

  const updatesQuery = useQuery({
    queryKey: updatesKey,
    enabled: !!selectedGoalId,
    queryFn: async () => {
      const { data, error } = await db
        .from<GoalUpdate[]>("goal_updates")
        .select("id, goal_id, value, notes, updated_by, created_at")
        .eq("goal_id", selectedGoalId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      return (data || []) as GoalUpdate[];
    },
  });

  useEffect(() => {
    if (!filteredGoals.length) {
      setSelectedGoalId(null);
      return;
    }

    const goalStillVisible = filteredGoals.some((goal) => goal.id === selectedGoalId);
    if (!goalStillVisible) {
      setSelectedGoalId(filteredGoals[0].id);
    }
  }, [filteredGoals, selectedGoalId]);

  useEffect(() => {
    if (selectedGoal) {
      setProgressValue(String(selectedGoal.current_value));
    }
  }, [selectedGoal]);

  const closeGoalDialog = () => {
    setGoalDialogOpen(false);
    setEditingGoal(null);
    setGoalFormData(defaultGoalFormData);
  };

  const openCreateGoalDialog = () => {
    setEditingGoal(null);
    setGoalFormData(defaultGoalFormData);
    setGoalDialogOpen(true);
  };

  const openEditGoalDialog = (goal: Goal) => {
    setEditingGoal(goal);
    setGoalFormData({
      title: goal.title,
      description: goal.description ?? "",
      type: goal.type,
      pillar: goal.pillar ?? "none",
      unit: goal.unit ?? "",
      target_value: goal.target_value?.toString() ?? "",
      current_value: String(goal.current_value),
      start_date: goal.start_date ?? "",
      end_date: goal.end_date ?? "",
      cadence: goal.cadence,
      status: goal.status,
      area_id: goal.area_id ?? "none",
      gamification_weight: String(goal.gamification_weight ?? 1),
    });
    setGoalDialogOpen(true);
  };

  const saveGoalMutation = useMutation({
    mutationFn: async () => {
      if (!goalFormData.title.trim()) {
        throw new Error("Informe o título da meta");
      }

      if (!editingGoal && !selectedCompanyId) {
        throw new Error("Selecione uma empresa para criar a meta");
      }

      const gamificationWeight = Number(goalFormData.gamification_weight || 1);
      if (Number.isNaN(gamificationWeight) || gamificationWeight <= 0) {
        throw new Error("Informe um peso da gamificacao maior que zero");
      }

      const payload = {
        title: goalFormData.title.trim(),
        description: goalFormData.description.trim() || null,
        type: goalFormData.type,
        pillar: goalFormData.pillar === "none" ? null : goalFormData.pillar,
        unit: goalFormData.unit.trim() || null,
        target_value: goalFormData.target_value === "" ? null : Number(goalFormData.target_value),
        current_value: Number(goalFormData.current_value || 0),
        start_date: goalFormData.start_date || null,
        end_date: goalFormData.end_date || null,
        cadence: goalFormData.cadence,
        status: goalFormData.status,
        area_id: goalFormData.area_id === "none" ? null : goalFormData.area_id,
        gamification_weight: gamificationWeight,
      };

      if (editingGoal) {
        const { error } = await db
          .from("goals")
          .update(payload)
          .eq("id", editingGoal.id);

        if (error) throw error;
        return "updated";
      }

      const { data, error } = await db
        .from<{ id: string }>("goals")
        .insert({
          ...payload,
          company_id: selectedCompanyId,
        })
        .select("id")
        .single();

      if (error) throw error;
      return data?.id as string | undefined;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: goalsKey });
      closeGoalDialog();
      toast({ title: editingGoal ? "Meta atualizada com sucesso" : "Meta criada com sucesso" });

      if (typeof result === "string" && result !== "updated") {
        setSelectedGoalId(result);
      }
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar meta",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const importGoalsMutation = useMutation({
    mutationFn: async () => {
      const validRows = importPreview.filter((row) => row.errors.length === 0);
      if (validRows.length === 0) {
        throw new Error("Nenhuma linha válida encontrada para importação.");
      }

      const payload = validRows.map((row) => ({
        company_id: row.companyId,
        area_id: row.areaId,
        title: row.title,
        description: row.description,
        type: row.goalType,
        pillar: row.pillar,
        target_value: row.targetValue,
        current_value: row.currentValue,
        cadence: row.cadence,
        status: "active" as Goal["status"],
        indicator_type: row.indicatorType,
        evaluation_points: row.evaluationPoints,
        gamification_weight: 1,
        effective_value: row.effectiveValue,
        kpi_n1: row.kpiN1,
      }));

      // Insert em chunks de 100 para evitar timeout em CSVs grandes (~520 linhas)
      const CHUNK_SIZE = 100;
      let inserted = 0;
      for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
        const chunk = payload.slice(i, i + CHUNK_SIZE);
        const { error } = await db.from("goals").insert(chunk);
        if (error) throw error;
        inserted += chunk.length;
      }
      return inserted;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: goalsKey });
      closeImportDialog();
      toast({
        title: "Importação concluída",
        description: `${count} meta(s) importada(s) com sucesso.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao importar metas",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (goal: Goal) => {
      const { error } = await db.from("goals").delete().eq("id", goal.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalsKey });
      queryClient.invalidateQueries({ queryKey: activitiesKey });
      queryClient.invalidateQueries({ queryKey: updatesKey });
      toast({ title: "Meta excluída" });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir meta",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const updateProgressMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGoalId) throw new Error("Selecione uma meta");

      const numericValue = Number(progressValue);
      if (Number.isNaN(numericValue) || numericValue < 0) {
        throw new Error("Informe um valor de progresso válido");
      }

      const { error } = await db
        .from("goals")
        .update({ current_value: numericValue })
        .eq("id", selectedGoalId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalsKey });
      queryClient.invalidateQueries({ queryKey: updatesKey });
      toast({ title: "Progresso atualizado" });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar progresso",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const createActivityMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGoalId) throw new Error("Selecione uma meta");
      if (!activityTitle.trim()) throw new Error("Informe o título da atividade");

      const payload = {
        goal_id: selectedGoalId,
        title: activityTitle.trim(),
        description: activityDescription.trim() || null,
        weight: Number(activityWeight || 1),
        due_date: activityDueDate || null,
      };

      if (payload.weight <= 0 || Number.isNaN(payload.weight)) {
        throw new Error("Peso da atividade deve ser maior que zero");
      }

      const { error } = await db.from("goal_activities").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesKey });
      setActivityTitle("");
      setActivityDescription("");
      setActivityWeight("1");
      setActivityDueDate("");
      toast({ title: "Atividade adicionada" });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar atividade",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const updateActivityMutation = useMutation({
    mutationFn: async ({
      activityId,
      status,
    }: {
      activityId: string;
      status: GoalActivity["status"];
    }) => {
      const { error } = await db
        .from("goal_activities")
        .update({ status })
        .eq("id", activityId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesKey });
      toast({ title: "Atividade atualizada" });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar atividade",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (activityId: string) => {
      const { error } = await db
        .from("goal_activities")
        .delete()
        .eq("id", activityId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesKey });
      toast({ title: "Atividade removida" });
    },
    onError: (error) => {
      toast({
        title: "Erro ao remover atividade",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const handleDeleteGoal = (goal: Goal) => {
    if (!canDelete) return;

    const confirmed = window.confirm(`Deseja excluir a meta "${goal.title}"?`);
    if (!confirmed) return;

    deleteGoalMutation.mutate(goal);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Metas</h1>
            <p className="text-muted-foreground mt-1">
              Portal de Metas — PE 2026 (CRESCER+ &amp; MELHOR) · agrupamento por área e indicador
            </p>
          </div>

          {canCreate && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => setImportDialogOpen(true)}
                disabled={companiesQuery.isLoading || areasQuery.isLoading}
              >
                <Upload className="h-4 w-4" />
                Importar Metas
              </Button>
              <Button onClick={openCreateGoalDialog} className="gap-2" disabled={!selectedCompanyId}>
                <Plus className="h-4 w-4" />
                Nova Meta
              </Button>
            </div>
          )}
        </div>

        {!selectedCompanyId && (
          <Card className="p-4 text-sm text-muted-foreground">
            Selecione uma empresa no topo para criar metas. A listagem abaixo mostra metas das empresas às
            quais você tem acesso.
          </Card>
        )}

        {gamificationSummaryQuery.data && (
          <Card className="p-4 bg-gradient-to-r from-primary/5 via-primary/10 to-transparent border-primary/20">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/15 p-2">
                  <Trophy className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Sua gamificação via Metas</p>
                  <p className="text-xs text-muted-foreground">
                    Os pontos das metas concluídas alimentam diretamente o ranking global.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <Badge variant="outline" className="text-xs">
                  Nível {gamificationSummaryQuery.data.level}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {gamificationSummaryQuery.data.totalPoints} pts totais
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {gamificationSummaryQuery.data.goalPoints} pts via metas ({gamificationSummaryQuery.data.goalCount})
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {gamificationSummaryQuery.data.ptsToNext} pts para o próximo nível
                </Badge>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/gamificacao" className="gap-1">
                    <Trophy className="h-3 w-3" />
                    Ver ranking
                  </Link>
                </Button>
              </div>
            </div>
          </Card>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <Card className="p-4 animate-fade-in-up space-y-3">
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[240px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Buscar por ação, KPI N1 ou descrição..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                    />
                  </div>
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos status</SelectItem>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="completed">Concluída</SelectItem>
                    <SelectItem value="paused">Pausada</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-3">
                <Select value={pillarFilter} onValueChange={setPillarFilter}>
                  <SelectTrigger className="w-[170px]">
                    <SelectValue placeholder="Pilar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos pilares</SelectItem>
                    <SelectItem value="FAT">FAT — Faturamento</SelectItem>
                    <SelectItem value="RT">RT — Rentabilidade</SelectItem>
                    <SelectItem value="CO">CO — Clima Org.</SelectItem>
                    <SelectItem value="MS">MS — Market Share</SelectItem>
                    <SelectItem value="SC">SC — Satisfação Cliente</SelectItem>
                    <SelectItem value="DN">DN — Distribuição Num.</SelectItem>
                    <SelectItem value="ESG">ESG</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={indicatorFilter} onValueChange={setIndicatorFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Indicador" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos indicadores</SelectItem>
                    <SelectItem value="PROJETO">Projeto</SelectItem>
                    <SelectItem value="PERFORMANCE">Performance</SelectItem>
                    <SelectItem value="PROCESSO">Processo</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={definedFilter} onValueChange={setDefinedFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Meta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas metas</SelectItem>
                    <SelectItem value="defined">Já definidas</SelectItem>
                    <SelectItem value="todefine">A definir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>

            {goalsQuery.isLoading ? (
              <Card className="p-8 flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando metas...
              </Card>
            ) : goalsQuery.error ? (
              <Card className="p-8 text-center text-destructive">
                Erro ao carregar metas. Tente novamente.
              </Card>
            ) : filteredGoals.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">Nenhuma meta encontrada.</Card>
            ) : (
              <TooltipProvider delayDuration={200}>
                <Accordion
                  type="multiple"
                  defaultValue={groupedByArea.slice(0, 3).map((g) => g.areaId ?? "__none__")}
                  className="space-y-2 animate-fade-in-up"
                >
                  {groupedByArea.map((area) => (
                    <AccordionItem
                      key={area.areaId ?? "__none__"}
                      value={area.areaId ?? "__none__"}
                      className="border rounded-md bg-card"
                    >
                      <AccordionTrigger className="px-4 hover:no-underline">
                        <div className="flex items-center gap-3 flex-1">
                          <span className="font-semibold text-foreground">{area.areaName}</span>
                          <Badge variant="outline">{area.total} {area.total === 1 ? "meta" : "metas"}</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 space-y-4">
                        {area.indicators.map((indGroup) => (
                          <div key={indGroup.indicator} className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={indicatorBadgeClass[indGroup.indicator] ?? "bg-muted"}
                              >
                                {indGroup.indicator}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {indGroup.goals.length} {indGroup.goals.length === 1 ? "item" : "itens"}
                              </span>
                            </div>
                            <div className="grid gap-2">
                              {indGroup.goals.map((goal) => {
                                const isSelected = goal.id === selectedGoalId;
                                const points = computeGoalPoints(goal);
                                return (
                                  <Card
                                    key={goal.id}
                                    className={`p-3 cursor-pointer transition-colors ${
                                      isSelected ? "border-primary/60" : "hover:border-primary/30"
                                    }`}
                                    onClick={() => setSelectedGoalId(goal.id)}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="space-y-2 flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                          {goal.kpi_n1 && (
                                            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                                              {goal.kpi_n1}
                                            </Badge>
                                          )}
                                          {goal.pillar && (
                                            <Badge variant="outline" className="text-[10px]">
                                              {goal.pillar} · {pillarLabel[goal.pillar]}
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="flex items-start gap-2">
                                          <Target className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                          <h3 className="font-medium text-sm text-foreground">{goal.title}</h3>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                          <Badge variant="secondary">{statusLabel[goal.status]}</Badge>
                                          <Badge variant="outline">{cadenceLabel[goal.cadence]}</Badge>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Badge variant="outline" className="cursor-help inline-flex items-center gap-1">
                                                <Sparkles className="h-3 w-3" />
                                                {goal.evaluation_points ?? "—"} pts
                                              </Badge>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="max-w-xs text-xs">
                                              <p className="font-medium">Ao concluir esta meta:</p>
                                              <p>+{points.responsible} pts (responsável)</p>
                                              <p>+{points.creator} pts (criador, se diferente)</p>
                                              <p className="text-muted-foreground mt-1">{points.basis}</p>
                                            </TooltipContent>
                                          </Tooltip>
                                          {goal.target_value === null ? (
                                            <Badge
                                              variant="outline"
                                              className="bg-yellow-500/10 text-yellow-600 border-yellow-500/40"
                                            >
                                              Meta a definir
                                            </Badge>
                                          ) : (
                                            <span className="text-muted-foreground">
                                              {goal.current_value} / {goal.target_value}
                                              {goal.unit ? ` ${goal.unit}` : ""}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0">
                                        {canEdit && (
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              openEditGoalDialog(goal);
                                            }}
                                          >
                                            <Pencil className="h-3.5 w-3.5" />
                                          </Button>
                                        )}
                                        {canDelete && (
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-destructive hover:text-destructive"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              handleDeleteGoal(goal);
                                            }}
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  </Card>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </TooltipProvider>
            )}
          </div>

          <div className="space-y-4">
            {!selectedGoal ? (
              <Card className="p-8 text-center text-muted-foreground">
                Selecione uma meta para visualizar atividades e histórico de progresso.
              </Card>
            ) : (
              <>
                <Card className="p-4 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">{selectedGoal.title}</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Cadência: {cadenceLabel[selectedGoal.cadence]} • Status: {statusLabel[selectedGoal.status]}
                      </p>
                      {selectedGoal.kpi_n1 && (
                        <Badge variant="secondary" className="mt-2 text-[10px] uppercase tracking-wide">
                          {selectedGoal.kpi_n1}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Período</p>
                      <p className="text-sm">
                        {formatDate(selectedGoal.start_date)} até {formatDate(selectedGoal.end_date)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Progresso atual</p>
                      <p className="text-sm font-medium">
                        {selectedGoal.current_value}
                        {selectedGoal.target_value !== null ? ` / ${selectedGoal.target_value}` : ""}
                        {selectedGoal.unit ? ` ${selectedGoal.unit}` : ""}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Tipo do indicador</p>
                      <p className="text-sm">{selectedGoal.indicator_type || "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Pontos por avaliação</p>
                      <p className="text-sm">{selectedGoal.evaluation_points ?? "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Efetivo</p>
                      <p className="text-sm">{selectedGoal.effective_value ?? "—"}</p>
                    </div>
                  </div>

                  <div className="rounded-md border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-medium">Gamificação</h3>
                      <Badge variant="outline">
                        Peso {formatWeight(selectedGoal.gamification_weight ?? 1)}
                      </Badge>
                    </div>
                    {(() => {
                      const pts = computeGoalPoints(selectedGoal);
                      return (
                        <>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Pontos por avaliação</p>
                              <p className="text-sm">{selectedGoal.evaluation_points ?? "—"}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Ao concluir</p>
                              <p className="text-sm">
                                +{pts.responsible} resp · +{pts.creator} criador
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {selectedGoal.target_value !== null &&
                            selectedGoal.current_value >= selectedGoal.target_value
                              ? "Pontuação de conclusão já enviada para a gamificação."
                              : `Cálculo: ${pts.basis}. Não altera o progresso da meta.`}
                          </p>
                        </>
                      );
                    })()}
                  </div>

                  <div className="space-y-2">
                    <Label>Atualizar progresso</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={progressValue}
                        onChange={(event) => setProgressValue(event.target.value)}
                        disabled={!canEdit || updateProgressMutation.isPending}
                      />
                      <Button
                        type="button"
                        onClick={() => updateProgressMutation.mutate()}
                        disabled={!canEdit || updateProgressMutation.isPending}
                      >
                        {updateProgressMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Salvar"
                        )}
                      </Button>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Atividades</h3>
                    <Badge variant="outline">{activitiesQuery.data?.length || 0}</Badge>
                  </div>

                  {(canCreate || canEdit) && (
                    <div className="space-y-2 border rounded-md p-3">
                      <Input
                        placeholder="Título da atividade"
                        value={activityTitle}
                        onChange={(event) => setActivityTitle(event.target.value)}
                      />
                      <Textarea
                        placeholder="Descrição (opcional)"
                        value={activityDescription}
                        onChange={(event) => setActivityDescription(event.target.value)}
                      />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder="Peso da atividade"
                          value={activityWeight}
                          onChange={(event) => setActivityWeight(event.target.value)}
                        />
                        <Input
                          type="date"
                          value={activityDueDate}
                          onChange={(event) => setActivityDueDate(event.target.value)}
                        />
                      </div>
                      <Button
                        type="button"
                        className="w-full"
                        onClick={() => createActivityMutation.mutate()}
                        disabled={createActivityMutation.isPending}
                      >
                        {createActivityMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Adicionar atividade"
                        )}
                      </Button>
                    </div>
                  )}

                  {activitiesQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando atividades...
                    </div>
                  ) : activitiesQuery.data?.length ? (
                    <div className="space-y-2">
                      {activitiesQuery.data.map((activity) => (
                        <div key={activity.id} className="border rounded-md p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium">{activity.title}</p>
                              {activity.description && (
                                <p className="text-xs text-muted-foreground mt-1">{activity.description}</p>
                              )}
                            </div>
                            {canDelete && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => deleteActivityMutation.mutate(activity.id)}
                                className="text-destructive hover:text-destructive"
                                disabled={deleteActivityMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <Badge variant="outline">Peso da atividade {activity.weight}</Badge>
                            <span className="text-muted-foreground inline-flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {formatDate(activity.due_date)}
                            </span>
                          </div>

                          <Select
                            value={activity.status}
                            onValueChange={(value) =>
                              updateActivityMutation.mutate({
                                activityId: activity.id,
                                status: value as GoalActivity["status"],
                              })
                            }
                            disabled={!canEdit || updateActivityMutation.isPending}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue>{activityStatusLabel[activity.status]}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pendente</SelectItem>
                              <SelectItem value="in_progress">Em andamento</SelectItem>
                              <SelectItem value="completed">Concluída</SelectItem>
                              <SelectItem value="cancelled">Cancelada</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma atividade cadastrada para esta meta.</p>
                  )}
                </Card>

                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Histórico de progresso</h3>
                    <Badge variant="outline">{updatesQuery.data?.length || 0}</Badge>
                  </div>

                  {updatesQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando histórico...
                    </div>
                  ) : updatesQuery.data?.length ? (
                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                      {updatesQuery.data.map((update) => (
                        <div key={update.id} className="border rounded-md p-3">
                          <p className="text-sm font-medium">Valor: {update.value}</p>
                          {update.notes && (
                            <p className="text-xs text-muted-foreground mt-1">{update.notes}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">{formatDate(update.created_at)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sem registros de progresso para esta meta.</p>
                  )}
                </Card>
              </>
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={importDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeImportDialog();
          else setImportDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Importar Metas em Lote</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Card className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Use o template <strong>Layout Portal Metas Ga360</strong> (PE 2026), salve a aba principal em
                <strong> CSV UTF-8</strong> e envie o arquivo abaixo. O importador detecta automaticamente
                ambos os formatos: o novo PE 2026 (colunas EMPRESA, ÁREA, INDICADOR, PILAR, KPI (N1), AÇÃO,
                PONTOS POR AVALIACAO, FREQUENCIA AVALIAÇÃO, META, OBSERVAÇÃO DA META) e o legacy.
                Linhas com META vazia serão importadas como <strong>"A definir"</strong>.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <Input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleImportFile(file);
                  }}
                />
                {importFileName && (
                  <Badge variant="outline">{importFileName}</Badge>
                )}
              </div>

              {importSummary && (
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">Linhas: {importSummary.totalRows}</Badge>
                  <Badge variant="secondary">Válidas: {importSummary.validRows}</Badge>
                  <Badge variant={importSummary.invalidRows > 0 ? "destructive" : "secondary"}>
                    Inválidas: {importSummary.invalidRows}
                  </Badge>
                </div>
              )}

              {importErrors.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-md border border-destructive/30 p-3 text-sm text-destructive">
                  {importErrors.slice(0, 20).map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                  {importErrors.length > 20 && (
                    <p>… e mais {importErrors.length - 20} erro(s).</p>
                  )}
                </div>
              )}
            </Card>

            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Preview da importação</h3>
                <Button
                  type="button"
                  onClick={() => importGoalsMutation.mutate()}
                  disabled={
                    importGoalsMutation.isPending ||
                    !importSummary ||
                    importSummary.validRows === 0
                  }
                >
                  {importGoalsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Importar linhas válidas"
                  )}
                </Button>
              </div>

              {importPreview.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Faça upload de um CSV derivado do template para visualizar o preview.
                </p>
              ) : (
                <div className="max-h-[420px] overflow-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="p-2 text-left">Linha</th>
                        <th className="p-2 text-left">Empresa</th>
                        <th className="p-2 text-left">Área</th>
                        <th className="p-2 text-left">KPI N1</th>
                        <th className="p-2 text-left">Ação / Título</th>
                        <th className="p-2 text-left">Indicador</th>
                        <th className="p-2 text-left">Pilar</th>
                        <th className="p-2 text-left">Cadência</th>
                        <th className="p-2 text-left">Pontos</th>
                        <th className="p-2 text-left">Meta</th>
                        <th className="p-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.map((row) => (
                        <tr key={`${row.rowNumber}-${row.title}`} className="border-t align-top">
                          <td className="p-2">{row.rowNumber}</td>
                          <td className="p-2">{row.companyName || row.raw["EMPRESA"] || "—"}</td>
                          <td className="p-2">{row.areaName || "—"}</td>
                          <td className="p-2 min-w-[140px]">{row.kpiN1 || "—"}</td>
                          <td className="p-2 min-w-[260px]">{row.title || "—"}</td>
                          <td className="p-2">{row.indicatorType || "—"}</td>
                          <td className="p-2">{row.pillar || "—"}</td>
                          <td className="p-2">{row.cadence}</td>
                          <td className="p-2">{row.evaluationPoints ?? "—"}</td>
                          <td className="p-2">
                            {row.targetValue !== null ? (
                              row.targetValue
                            ) : (
                              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/40">
                                A definir
                              </Badge>
                            )}
                          </td>
                          <td className="p-2">
                            {row.errors.length === 0 ? (
                              <Badge variant="secondary">Pronta</Badge>
                            ) : (
                              <div className="space-y-1">
                                <Badge variant="destructive">Com erro</Badge>
                                {row.errors.map((error) => (
                                  <p key={error} className="text-xs text-destructive">{error}</p>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={goalDialogOpen}
        onOpenChange={(open) => {
          setGoalDialogOpen(open);
          if (!open) closeGoalDialog();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingGoal ? "Editar Meta" : "Nova Meta"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 space-y-2">
              <Label>Título</Label>
              <Input
                value={goalFormData.title}
                onChange={(event) =>
                  setGoalFormData((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="Ex.: Aumentar margem operacional"
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={goalFormData.description}
                onChange={(event) =>
                  setGoalFormData((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Contexto e escopo da meta"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={goalFormData.type}
                onValueChange={(value) =>
                  setGoalFormData((prev) => ({ ...prev, type: value as Goal["type"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="numeric">Numérica</SelectItem>
                  <SelectItem value="activity">Atividade</SelectItem>
                  <SelectItem value="hybrid">Híbrida</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Pilar</Label>
              <Select
                value={goalFormData.pillar}
                onValueChange={(value) =>
                  setGoalFormData((prev) => ({ ...prev, pillar: value as GoalFormData["pillar"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem pilar</SelectItem>
                  <SelectItem value="FAT">FAT</SelectItem>
                  <SelectItem value="RT">RT</SelectItem>
                  <SelectItem value="MS">MS</SelectItem>
                  <SelectItem value="SC">SC</SelectItem>
                  <SelectItem value="DN">DN</SelectItem>
                  <SelectItem value="CO">CO</SelectItem>
                  <SelectItem value="ESG">ESG</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Área</Label>
              <Select
                value={goalFormData.area_id}
                onValueChange={(value) =>
                  setGoalFormData((prev) => ({ ...prev, area_id: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem área</SelectItem>
                  {(areasQuery.data || []).map((area) => (
                    <SelectItem key={area.id} value={area.id}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Peso da gamificação</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={goalFormData.gamification_weight}
                onChange={(event) =>
                  setGoalFormData((prev) => ({ ...prev, gamification_weight: event.target.value }))
                }
                placeholder="1"
              />
              <p className="text-xs text-muted-foreground">
                Define quantos pontos esta meta gera ao ser concluída. Não altera o progresso da meta.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Unidade</Label>
              <Input
                value={goalFormData.unit}
                onChange={(event) =>
                  setGoalFormData((prev) => ({ ...prev, unit: event.target.value }))
                }
                placeholder="Ex.: %, R$, unidades"
              />
            </div>

            <div className="space-y-2">
              <Label>Valor Atual</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={goalFormData.current_value}
                onChange={(event) =>
                  setGoalFormData((prev) => ({ ...prev, current_value: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Valor Alvo</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={goalFormData.target_value}
                onChange={(event) =>
                  setGoalFormData((prev) => ({ ...prev, target_value: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Data Início</Label>
              <Input
                type="date"
                value={goalFormData.start_date}
                onChange={(event) =>
                  setGoalFormData((prev) => ({ ...prev, start_date: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Data Fim</Label>
              <Input
                type="date"
                value={goalFormData.end_date}
                onChange={(event) =>
                  setGoalFormData((prev) => ({ ...prev, end_date: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Cadência</Label>
              <Select
                value={goalFormData.cadence}
                onValueChange={(value) =>
                  setGoalFormData((prev) => ({ ...prev, cadence: value as Goal["cadence"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="quarterly">Trimestral</SelectItem>
                  <SelectItem value="semester">Semestral</SelectItem>
                  <SelectItem value="annual">Anual</SelectItem>
                  <SelectItem value="activity">Atividade</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={goalFormData.status}
                onValueChange={(value) =>
                  setGoalFormData((prev) => ({ ...prev, status: value as Goal["status"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="completed">Concluída</SelectItem>
                  <SelectItem value="paused">Pausada</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={closeGoalDialog}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveGoalMutation.mutate()}
              disabled={
                saveGoalMutation.isPending || (!editingGoal && !canCreate) || (Boolean(editingGoal) && !canEdit)
              }
            >
              {saveGoalMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingGoal ? (
                "Salvar"
              ) : (
                "Criar"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
