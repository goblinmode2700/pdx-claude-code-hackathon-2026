import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Vehicle route colors
export const VEHICLE_COLORS: Record<string, string> = {
  V001: "#6366f1", // indigo
  V002: "#f59e0b", // amber
  V003: "#10b981", // emerald
  V004: "#8b5cf6", // violet
  V005: "#ec4899", // pink
};

export const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#3b82f6",
  low: "#6b7280",
};
