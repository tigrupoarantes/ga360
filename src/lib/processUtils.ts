import { addDays, addWeeks, addMonths } from "date-fns";

export const frequencyLabels: Record<string, string> = {
  daily: "Diária",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
};

export function getNextExecutionDate(frequency: string, lastExecution: Date | null): Date {
  const baseDate = lastExecution || new Date();
  
  switch (frequency) {
    case "daily":
      return lastExecution ? addDays(baseDate, 1) : baseDate;
    case "weekly":
      return lastExecution ? addWeeks(baseDate, 1) : baseDate;
    case "biweekly":
      return lastExecution ? addDays(baseDate, 14) : baseDate;
    case "monthly":
      return lastExecution ? addMonths(baseDate, 1) : baseDate;
    default:
      return baseDate;
  }
}

export function isProcessOverdue(nextExecution: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next = new Date(nextExecution);
  next.setHours(0, 0, 0, 0);
  return next < today;
}

export function getFrequencyColor(frequency: string): string {
  switch (frequency) {
    case "daily":
      return "bg-blue-500";
    case "weekly":
      return "bg-green-500";
    case "biweekly":
      return "bg-yellow-500";
    case "monthly":
      return "bg-purple-500";
    default:
      return "bg-gray-500";
  }
}
