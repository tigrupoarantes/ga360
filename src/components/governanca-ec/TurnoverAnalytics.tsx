import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ComposedChart, Bar, Line, BarChart, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { TrendingDown, TrendingUp, Users, UserMinus } from 'lucide-react';
import {
  startOfMonth, endOfMonth, subMonths,
  startOfQuarter, endOfQuarter, subQuarters,
  startOfYear, endOfYear, subYears,
  parseISO,
} from 'date-fns';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Employee {
  id: string;
  hire_date: string | null;
  termination_date: string | null;
  is_active: boolean | null;
  full_name: string;
  department: string | null;
  position: string | null;
  company_id: string | null;
}

interface Props {
  employees: Employee[];
}

type PeriodType = 'monthly' | 'quarterly' | 'annual';

interface PeriodData {
  label: string;
  start: Date;
  end: Date;
  hires: number;
  terminations: number;
  headcountStart: number;
  headcountEnd: number;
  avgHeadcount: number;
  turnoverRate: number;
}

function generatePeriods(type: PeriodType): { label: string; start: Date; end: Date }[] {
  const now = new Date();
  const periods: { label: string; start: Date; end: Date }[] = [];

  if (type === 'monthly') {
    for (let i = 11; i >= 0; i--) {
      const ref = subMonths(now, i);
      periods.push({
        label: format(ref, "MMM/yy", { locale: ptBR }),
        start: startOfMonth(ref),
        end: endOfMonth(ref),
      });
    }
  } else if (type === 'quarterly') {
    for (let i = 7; i >= 0; i--) {
      const ref = subQuarters(now, i);
      const qStart = startOfQuarter(ref);
      const q = Math.ceil((qStart.getMonth() + 1) / 3);
      periods.push({
        label: `${q}T/${format(ref, "yy")}`,
        start: qStart,
        end: endOfQuarter(ref),
      });
    }
  } else {
    for (let i = 2; i >= 0; i--) {
      const ref = subYears(now, i);
      periods.push({
        label: format(ref, "yyyy"),
        start: startOfYear(ref),
        end: endOfYear(ref),
      });
    }
  }

  return periods;
}

function safeParseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  try {
    return parseISO(dateStr);
  } catch {
    return null;
  }
}

function isBeforeOrEqual(d: Date, ref: Date): boolean {
  return d.getTime() <= ref.getTime();
}

function isAfter(d: Date, ref: Date): boolean {
  return d.getTime() > ref.getTime();
}

function isWithin(d: Date, start: Date, end: Date): boolean {
  return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
}

export function TurnoverAnalytics({ employees }: Props) {
  const [periodType, setPeriodType] = useState<PeriodType>('monthly');

  const periodData = useMemo<PeriodData[]>(() => {
    const periods = generatePeriods(periodType);

    return periods.map(({ label, start, end }) => {
      let hires = 0;
      let terminations = 0;
      let headcountStart = 0;
      let headcountEnd = 0;

      for (const emp of employees) {
        const hireDate = safeParseDate(emp.hire_date);
        const termDate = safeParseDate(emp.termination_date);

        // Hires within period
        if (hireDate && isWithin(hireDate, start, end)) {
          hires++;
        }

        // Terminations within period
        if (termDate && isWithin(termDate, start, end)) {
          terminations++;
        }

        // Headcount at start of period
        if (hireDate && isBeforeOrEqual(hireDate, start)) {
          if (!termDate || isAfter(termDate, start)) {
            headcountStart++;
          }
        }

        // Headcount at end of period
        if (hireDate && isBeforeOrEqual(hireDate, end)) {
          if (!termDate || isAfter(termDate, end)) {
            headcountEnd++;
          }
        }
      }

      const avgHeadcount = (headcountStart + headcountEnd) / 2;
      const turnoverRate = avgHeadcount > 0 ? (terminations / avgHeadcount) * 100 : 0;

      return {
        label,
        start,
        end,
        hires,
        terminations,
        headcountStart,
        headcountEnd,
        avgHeadcount: Math.round(avgHeadcount),
        turnoverRate: Math.round(turnoverRate * 100) / 100,
      };
    });
  }, [employees, periodType]);

  const currentMonth = useMemo(() => {
    if (periodData.length === 0) {
      return { turnoverRate: 0, terminations: 0, avgHeadcount: 0, hires: 0 };
    }
    return periodData[periodData.length - 1];
  }, [periodData]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <TrendingDown className="h-4 w-4" />
          Analise de Turnover
        </h3>
        <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">Mensal</SelectItem>
            <SelectItem value="quarterly">Trimestral</SelectItem>
            <SelectItem value="annual">Anual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendingDown className={cn("h-3.5 w-3.5", currentMonth.turnoverRate > 5 ? "text-red-500" : "text-green-500")} />
              Taxa de Turnover
            </div>
            <p className={cn(
              "text-xl font-bold",
              currentMonth.turnoverRate > 5 ? "text-red-600" : "text-green-600"
            )}>
              {currentMonth.turnoverRate.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card className="p-3">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <UserMinus className="h-3.5 w-3.5 text-red-500" />
              Desligamentos
            </div>
            <p className="text-xl font-bold">{currentMonth.terminations}</p>
          </CardContent>
        </Card>

        <Card className="p-3">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Users className="h-3.5 w-3.5" />
              Headcount Medio
            </div>
            <p className="text-xl font-bold">{currentMonth.avgHeadcount}</p>
          </CardContent>
        </Card>

        <Card className="p-3">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-green-500" />
              Admissoes
            </div>
            <p className="text-xl font-bold text-green-600">{currentMonth.hires}</p>
          </CardContent>
        </Card>
      </div>

      {/* Turnover Trend Chart */}
      <Card>
        <CardContent className="pt-4 pb-2 px-2">
          <p className="text-sm font-medium mb-3 px-2">Tendencia de Turnover</p>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={periodData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => `${v}%`}
                domain={[0, 'auto']}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11 }}
                domain={[0, 'auto']}
              />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value: number, name: string) => {
                  if (name === 'turnoverRate') return [`${value.toFixed(1)}%`, 'Taxa de Turnover'];
                  if (name === 'terminations') return [value, 'Desligamentos'];
                  return [value, name];
                }}
                labelFormatter={(label: string) => `Periodo: ${label}`}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value: string) => {
                  if (value === 'terminations') return 'Desligamentos';
                  if (value === 'turnoverRate') return 'Taxa (%)';
                  return value;
                }}
              />
              <Bar
                yAxisId="right"
                dataKey="terminations"
                fill="#ef4444"
                opacity={0.7}
                radius={[3, 3, 0, 0]}
                barSize={24}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="turnoverRate"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Hires vs Terminations Chart */}
      <Card>
        <CardContent className="pt-4 pb-2 px-2">
          <p className="text-sm font-medium mb-3 px-2">Admissoes vs Desligamentos</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={periodData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 'auto']} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value: number, name: string) => {
                  if (name === 'hires') return [value, 'Admissoes'];
                  if (name === 'terminations') return [value, 'Desligamentos'];
                  return [value, name];
                }}
                labelFormatter={(label: string) => `Periodo: ${label}`}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value: string) => {
                  if (value === 'hires') return 'Admissoes';
                  if (value === 'terminations') return 'Desligamentos';
                  return value;
                }}
              />
              <Bar dataKey="hires" fill="#22c55e" radius={[3, 3, 0, 0]} barSize={20} />
              <Bar dataKey="terminations" fill="#ef4444" radius={[3, 3, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
