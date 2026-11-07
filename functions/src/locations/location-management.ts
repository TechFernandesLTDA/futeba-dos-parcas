/**
 * Barrel / facade de gestão de quadras e controles comerciais (D4).
 * Reexporta todos os submódulos por responsabilidade para preservar
 * compatibilidade total de imports e Cloud Functions publicadas.
 */
export type * from "./location-types-helpers";
export * from "./location-aggregates";
export * from "./location-billing";
export * from "./location-publication-ownership";
export * from "./location-auto-ratings";
