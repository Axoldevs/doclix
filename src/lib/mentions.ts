export interface MentionableUser {
  userId: string;
  name: string;
}

/** Matches @username tokens: letters/digits/dots/underscores/hyphens,
 * stopping at whitespace or punctuation that wouldn't appear in a name
 * token. Mentions are resolved against a project's team member list by
 * case-insensitive, whitespace-stripped name match (see
 * resolveMentions) -- there's no stored "username" field, display names
 * double as the mention handle. */
const MENTION_PATTERN = /@([a-zA-Z0-9_.-]+)/g;

function normalize(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '');
}

/** Finds every @token in `body` and resolves it against `candidates` by
 * normalized name match. Returns the matched user ids (deduped) and,
 * separately, the raw tokens that didn't match anyone (useful for
 * autocomplete UIs, not currently surfaced to the end user). */
export function resolveMentions(
  body: string,
  candidates: MentionableUser[]
): { userIds: string[]; unmatchedTokens: string[] } {
  const byNormalizedName = new Map(candidates.map((c) => [normalize(c.name), c.userId]));
  const userIds = new Set<string>();
  const unmatchedTokens: string[] = [];

  for (const match of body.matchAll(MENTION_PATTERN)) {
    const token = match[1];
    const userId = byNormalizedName.get(normalize(token));
    if (userId) userIds.add(userId);
    else unmatchedTokens.push(token);
  }

  return { userIds: Array.from(userIds), unmatchedTokens };
}
