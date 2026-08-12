/**
 * Utilitario para mesclar classes CSS com suporte a Tailwind.
 * Combina clsx (logica condicional de classes) com tailwind-merge
 * (resolucao de conflitos entre classes Tailwind).
 *
 * @param {...(string|object|array)} inputs - Classes CSS ou expressoes condicionais
 * @returns {string} String de classes CSS mescladas sem conflitos
 *
 * @example
 * cn('px-4 py-2', isActive && 'bg-primary', 'px-6')
 * // Resultado: 'py-2 bg-primary px-6' (px-4 removido em favor de px-6)
 */
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
