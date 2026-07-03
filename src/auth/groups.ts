/**
 * Auth-grupper: felles innlogging pa tvers av publikasjoner i samme mediekonsern.
 * Sesjon lagres som sessions/<gruppe-id>.json og deles av alle kilder i gruppen.
 */
export type AuthGroupId = "schibsted" | "dn-media";

export interface AuthGroup {
  id: AuthGroupId;
  name: string;
  /** URL vi apner for manuell innlogging (felles SSO). */
  loginUrl: string;
  /** Publikasjoner som deler denne sesjonen (dokumentasjon). */
  publications: string[];
}

export const AUTH_GROUPS: Record<AuthGroupId, AuthGroup> = {
  schibsted: {
    id: "schibsted",
    name: "Schibsted",
    loginUrl: "https://www.aftenposten.no/",
    publications: ["Aftenposten", "VG", "BT", "…"],
  },
  "dn-media": {
    id: "dn-media",
    name: "DN Media Group",
    loginUrl: "https://www.tradewindsnews.com/",
    publications: ["TradeWinds", "DN", "…"],
  },
};

export const AUTH_GROUP_IDS = Object.keys(AUTH_GROUPS) as AuthGroupId[];

export function getAuthGroup(id: AuthGroupId): AuthGroup {
  return AUTH_GROUPS[id];
}
