import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface ReportViewerProps {
  content: string;
  onExportPdf?: () => void;
  isLoading?: boolean;
}

interface ChartData {
  type: "bar" | "pie" | "line";
  title: string;
  data: { name: string; value: number }[];
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function parseCharts(content: string): { text: string; charts: ChartData[] } {
  const charts: ChartData[] = [];
  const chartRegex = /<!-- CHART:(bar|pie|line) title="([^"]+)" -->\n([\s\S]*?)<!-- \/CHART -->/g;

  let match;
  let cleanedContent = content;

  while ((match = chartRegex.exec(content)) !== null) {
    const [fullMatch, type, title, tableContent] = match;

    // Parse markdown table
    const rows = tableContent
      .trim()
      .split("\n")
      .filter((row) => row.includes("|") && !row.includes("---"));

    if (rows.length > 1) {
      const data = rows.slice(1).map((row) => {
        const cells = row
          .split("|")
          .map((cell) => cell.trim())
          .filter(Boolean);
        return {
          name: cells[0] || "",
          value: parseInt(cells[1]) || 0,
        };
      });

      charts.push({
        type: type as "bar" | "pie" | "line",
        title,
        data,
      });
    }

    cleanedContent = cleanedContent.replace(fullMatch, `[CHART:${charts.length - 1}]`);
  }

  return { text: cleanedContent, charts };
}

function renderMarkdown(text: string): JSX.Element[] {
  const lines = text.split("\n");
  const elements: JSX.Element[] = [];
  let inTable = false;
  let tableRows: string[] = [];
  let inList = false;
  let listItems: string[] = [];

  const flushTable = () => {
    if (tableRows.length > 0) {
      const headers = tableRows[0]
        .split("|")
        .map((h) => h.trim())
        .filter(Boolean);
      const dataRows = tableRows.slice(2); // Skip header and separator

      elements.push(
        <div key={`table-${elements.length}`} className="overflow-x-auto my-4">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted">
                {headers.map((header, i) => (
                  <th
                    key={i}
                    className="border border-border px-3 py-2 text-left text-sm font-medium"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, rowIndex) => {
                const cells = row
                  .split("|")
                  .map((c) => c.trim())
                  .filter(Boolean);
                return (
                  <tr key={rowIndex} className="even:bg-muted/50">
                    {cells.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        className="border border-border px-3 py-2 text-sm"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
    }
  };

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 my-2 ml-4">
          {listItems.map((item, i) => (
            <li key={i} className="text-sm text-foreground">
              {item}
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  lines.forEach((line, index) => {
    // Check for table
    if (line.includes("|") && line.trim().startsWith("|")) {
      if (!inTable) {
        flushList();
        inTable = true;
      }
      tableRows.push(line);
      return;
    } else if (inTable) {
      inTable = false;
      flushTable();
    }

    // Check for list items
    if (line.trim().match(/^[-*•]\s/)) {
      if (!inList) {
        inList = true;
      }
      listItems.push(line.trim().replace(/^[-*•]\s/, ""));
      return;
    } else if (inList) {
      inList = false;
      flushList();
    }

    // Headers
    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={index} className="text-lg font-semibold mt-6 mb-2 text-foreground">
          {line.replace("### ", "")}
        </h3>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2 key={index} className="text-xl font-bold mt-8 mb-3 text-foreground border-b pb-2">
          {line.replace("## ", "")}
        </h2>
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h1 key={index} className="text-2xl font-bold mt-4 mb-4 text-foreground">
          {line.replace("# ", "")}
        </h1>
      );
    }
    // Chart placeholder
    else if (line.match(/\[CHART:\d+\]/)) {
      const chartIndex = parseInt(line.match(/\[CHART:(\d+)\]/)?.[1] || "0");
      elements.push(<div key={index} data-chart-index={chartIndex} className="chart-placeholder" />);
    }
    // Bold text
    else if (line.includes("**")) {
      elements.push(
        <p key={index} className="text-sm my-2 text-foreground">
          {line.split(/(\*\*.*?\*\*)/).map((part, i) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return (
                <strong key={i} className="font-semibold">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return part;
          })}
        </p>
      );
    }
    // Horizontal rule
    else if (line.match(/^---+$/)) {
      elements.push(<hr key={index} className="my-4 border-border" />);
    }
    // Regular text
    else if (line.trim()) {
      elements.push(
        <p key={index} className="text-sm my-1 text-foreground leading-relaxed">
          {line}
        </p>
      );
    }
    // Empty line
    else {
      elements.push(<div key={index} className="h-2" />);
    }
  });

  // Flush remaining
  if (inTable) flushTable();
  if (inList) flushList();

  return elements;
}

function ChartComponent({ chart }: { chart: ChartData }) {
  if (chart.type === "pie") {
    return (
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={chart.data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
            outerRadius={80}
            fill="hsl(var(--primary))"
            dataKey="value"
          >
            {chart.data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chart.type === "line") {
    return (
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chart.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Default: bar chart
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chart.data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
        <Tooltip />
        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ReportViewer({ content, onExportPdf, isLoading }: ReportViewerProps) {
  const { text, charts } = useMemo(() => parseCharts(content), [content]);
  const renderedContent = useMemo(() => renderMarkdown(text), [text]);

  // Insert charts at their placeholders
  const finalContent = renderedContent.map((element, index) => {
    if (
      element.props?.className?.includes("chart-placeholder") &&
      element.props?.["data-chart-index"] !== undefined
    ) {
      const chartIndex = element.props["data-chart-index"];
      const chart = charts[chartIndex];
      if (chart) {
        return (
          <Card key={`chart-${index}`} className="my-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{chart.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartComponent chart={chart} />
            </CardContent>
          </Card>
        );
      }
    }
    return element;
  });

  if (!content && !isLoading) {
    return (
      <Card className="flex-1">
        <CardContent className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Seu relatório aparecerá aqui após a geração
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex-1 overflow-hidden">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-4 border-b">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Relatório Gerado
        </CardTitle>
        {content && onExportPdf && (
          <Button variant="outline" size="sm" onClick={onExportPdf}>
            <Download className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-6 overflow-y-auto max-h-[600px]">
        <div className="prose prose-sm max-w-none">
          {finalContent}
          {isLoading && (
            <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
