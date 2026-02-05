import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names using clsx and then merges them with tailwind-merge.
 * @param {ClassValue[]} inputs - An array of class names to combine.
 * @returns {string} - The merged class names.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}