import { existsSync } from "node:fs";
import { getSource, SOURCES } from "../sources/registry.js";
import {
  isArticleSource,
  type ArticleSourceConfig,
} from "../sources/types.js";
import {
  AUTH_GROUP_IDS,
  AUTH_GROUPS,
  type AuthGroup,
  type AuthGroupId,
} from "./groups.js";

/** Eldre per-kilde sesjonsfiler (for bakoverkompatibilitet). */
const LEGACY_SESSION_FILES: Partial<Record<AuthGroupId, string>> = {
  schibsted: "sessions/aftenposten.json",
};

export function sessionPathForGroup(groupId: AuthGroupId): string {
  return `sessions/${groupId}.json`;
}

/** Finn eksisterende sesjonsfil for en auth-gruppe (inkl. legacy-sti). */
export function resolveSessionPath(groupId: AuthGroupId): string | undefined {
  const primary = sessionPathForGroup(groupId);
  if (existsSync(primary)) return primary;
  const legacy = LEGACY_SESSION_FILES[groupId];
  if (legacy && existsSync(legacy)) return legacy;
  return undefined;
}

export function sessionExists(groupId: AuthGroupId): boolean {
  return resolveSessionPath(groupId) !== undefined;
}

export function resolveSessionPathForSource(
  source: ArticleSourceConfig,
): string | undefined {
  if (source.auth === "none") return undefined;
  return resolveSessionPath(source.auth);
}

export function authLabelForSource(source: ArticleSourceConfig): string {
  if (source.auth === "none") return "apen";
  const group = AUTH_GROUPS[source.auth];
  return sessionExists(source.auth)
    ? `${group.name} ✓`
    : `${group.name} ⨯ (mangler login)`;
}

export type LoginTarget =
  | { kind: "group"; group: AuthGroup }
  | { kind: "source"; group: AuthGroup; source: ArticleSourceConfig };

/**
 * Los opp login-mal fra auth-gruppe-id eller kilde-id.
 *   npm run login schibsted
 *   npm run login tradewinds   -> dn-media
 */
export function resolveLoginTarget(arg: string): LoginTarget | undefined {
  if ((AUTH_GROUP_IDS as string[]).includes(arg)) {
    return { kind: "group", group: AUTH_GROUPS[arg as AuthGroupId] };
  }

  const source = getSource(arg);
  if (source && isArticleSource(source) && source.auth !== "none") {
    return {
      kind: "source",
      group: AUTH_GROUPS[source.auth],
      source,
    };
  }

  return undefined;
}

export function sourcesForAuthGroup(groupId: AuthGroupId): ArticleSourceConfig[] {
  return SOURCES.filter(
    (s): s is ArticleSourceConfig =>
      isArticleSource(s) && s.auth === groupId,
  );
}
