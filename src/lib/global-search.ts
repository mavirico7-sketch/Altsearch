import crypto from "crypto";
import { eq } from "drizzle-orm";
import { getConfig } from "./config";
import { getDb, getDbClient } from "./db";
import { siteEmbeddings } from "./schema";
import type { SiteFile } from "./schema";
import { getSiteByName, getSiteUrl } from "./sites-config";

type SearchableSite = SiteFile & {
  eventTitle: string;
  eventDescription: string;
};

export type GlobalSearchResult = {
  eventId: string;
  siteFileId: number;
  siteName: string;
  title: string;
  displayUrl: string;
  snippet: string;
  score: number;
  eventTitle: string;
  debug?: {
    lexicalRaw: number;
    lexicalWeighted: number;
    titleSimilarity: number;
    descriptionSimilarity: number;
    siteNameSimilarity: number;
    titleWeighted: number;
    descriptionWeighted: number;
    siteNameWeighted: number;
    semantic: number;
  };
};

type SiteEmbeddingTexts = {
  title: string;
  description: string;
  siteName: string;
};

type SiteEmbeddingVectors = {
  title: number[];
  description: number[];
  siteName: number[];
};

type SemanticScore = {
  titleSimilarity: number;
  descriptionSimilarity: number;
  siteNameSimilarity: number;
  titleWeighted: number;
  descriptionWeighted: number;
  siteNameWeighted: number;
  semantic: number;
};

const LEXICAL_WEIGHT = 0.35;

function nowMs() {
  return Date.now();
}

export function globalResultHref(result: Pick<GlobalSearchResult, "eventId" | "siteName">) {
  return getSiteUrl(result.eventId, result.siteName);
}

function hashText(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function siteEmbeddingTexts(site: {
  siteName: string;
  title: string;
  displayUrl: string;
  snippet: string;
  eventTitle: string;
  eventDescription: string;
}): SiteEmbeddingTexts {
  return {
    title: `Title: ${site.title}`,
    description: `Description: ${site.snippet}`,
    siteName: `Site: ${site.siteName}`,
  };
}

export function siteEmbeddingText(site: Parameters<typeof siteEmbeddingTexts>[0]) {
  const texts = siteEmbeddingTexts(site);
  return [
    texts.title,
    texts.description,
    texts.siteName,
  ].join("\n\n");
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function lexicalScore(query: string, site: SearchableSite) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 0;

  const title = normalizeSearchText(site.title);
  const url = normalizeSearchText(site.displayUrl);
  const snippet = normalizeSearchText(site.snippet);
  const siteName = normalizeSearchText(site.siteName);
  let score = 0;

  if (title === normalizedQuery) score += 20;
  if (title.includes(normalizedQuery)) score += 12;
  if (normalizedQuery.includes(title) && title.length > 3) score += 8;
  if (url.includes(normalizedQuery)) score += 10;
  if (snippet.includes(normalizedQuery)) score += 5;
  if (normalizedQuery.split(" ").includes(siteName)) score += 3;

  const tokens = normalizedQuery.split(" ").filter((token) => token.length > 1);
  for (const token of tokens) {
    if (title.includes(token)) score += 1.5;
    if (url.includes(token)) score += 1;
    if (snippet.includes(token)) score += 0.5;
  }

  return score;
}

export async function sampleEmbeddingText() {
  const site = (await listSearchableSites())[0];
  return site ? siteEmbeddingText(site) : "";
}

let _extractor: any = null;

async function createEmbedding(input: string) {
  const cfg = getConfig();

  if (cfg.embeddings.local) {
    const transformers = await import("@huggingface/transformers");
    transformers.env.cacheDir = "/data/huggingface_cache";
    const { pipeline } = transformers;
    
    if (!_extractor) {
      _extractor = await pipeline("feature-extraction", cfg.embeddings.model);
    }
    const output = await _extractor(input, { pooling: "mean", normalize: true });
    return Array.from(output.data) as number[];
  }

  const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: cfg.embeddings.model,
      input,
    }),
  });

  const data = await response.json().catch(() => ({})) as {
    data?: { embedding?: number[] }[];
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(data.error?.message ?? `Embeddings request failed with HTTP ${response.status}.`);
  }

  const embedding = data.data?.[0]?.embedding;
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error("Embeddings response did not include a vector.");
  }
  return embedding;
}

async function createSiteEmbeddings(site: SearchableSite) {
  const texts = siteEmbeddingTexts(site);
  return {
    texts,
    textHash: hashText([texts.title, texts.description, texts.siteName].join("\n\n")),
    embeddings: {
      title: await createEmbedding(texts.title),
      description: await createEmbedding(texts.description),
      siteName: await createEmbedding(texts.siteName),
    },
  };
}

async function listSearchableSites(scope: "global" | "my_events" = "global", userId?: string): Promise<SearchableSite[]> {
  return (await listSearchableSitesWithScores(undefined, scope, userId)).map(({ site }) => site);
}

async function upsertEmbedding(input: {
  site: SearchableSite;
  model: string;
  textHash: string;
  embeddings?: SiteEmbeddingVectors;
  error?: string;
}) {
  const db = await getDb();
  const existing = await db
    .select()
    .from(siteEmbeddings)
    .where(eq(siteEmbeddings.siteFileId, input.site.id))
    .get();

  const values = {
    eventId: input.site.eventId,
    model: input.model,
    embeddingTextHash: input.textHash,
    status: input.embeddings ? "complete" as const : "failed" as const,
    error: input.error ?? null,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(siteEmbeddings)
      .set(values)
      .where(eq(siteEmbeddings.id, existing.id))
      .run();
    if (input.embeddings) await updateVectorEmbeddings(input.site.id, input.embeddings);
    return;
  }

  await db.insert(siteEmbeddings).values({
    siteFileId: input.site.id,
    ...values,
  }).run();
  if (input.embeddings) await updateVectorEmbeddings(input.site.id, input.embeddings);
}

async function updateVectorEmbeddings(siteFileId: number, embeddings: SiteEmbeddingVectors) {
  const client = await getDbClient();
  await client.execute({
    sql: `
      UPDATE site_embeddings
      SET
        title_embedding = vector32(?),
        description_embedding = vector32(?),
        site_name_embedding = vector32(?)
      WHERE site_file_id = ?
    `,
    args: [
      JSON.stringify(embeddings.title),
      JSON.stringify(embeddings.description),
      JSON.stringify(embeddings.siteName),
      siteFileId,
    ],
  });
}

export async function refreshSiteEmbedding(site: SearchableSite) {
  const cfg = getConfig();
  if (!cfg.embeddings.enabled) return;

  try {
    const { textHash, embeddings } = await createSiteEmbeddings(site);
    await upsertEmbedding({ site, model: cfg.embeddings.model, textHash, embeddings });
  } catch (err) {
    const texts = siteEmbeddingTexts(site);
    const textHash = hashText([texts.title, texts.description, texts.siteName].join("\n\n"));
    const error = err instanceof Error ? err.message : String(err);
    await upsertEmbedding({ site, model: cfg.embeddings.model, textHash, error });
  }
}

function fallbackSearch(query: string, sites: SearchableSite[]): GlobalSearchResult[] {
  const normalized = query.trim();
  const cfg = getConfig();
  const scored = sites
    .map((site) => ({ site, score: lexicalScore(normalized, site) }))
    .filter((item) => !normalized || item.score >= cfg.search.min_score)
    .sort((left, right) => right.score - left.score);

  return scored.map(({ site, score }) => ({
    eventId: site.eventId,
    siteFileId: site.id,
    siteName: site.siteName,
    title: site.title,
    displayUrl: site.displayUrl,
    snippet: site.snippet,
    score,
    eventTitle: site.eventTitle,
  }));
}

async function listSearchableSitesWithScores(queryVector?: number[], scope: "global" | "my_events" = "global", userId?: string) {
  const client = await getDbClient();
  const vectorJson = queryVector ? JSON.stringify(queryVector) : null;
  
  const whereClause = scope === "my_events" && userId 
    ? "sf.status = 'complete' AND e.user_id = ?"
    : "sf.status = 'complete' AND e.is_private = 0";

  const sqlQuery = `
      SELECT
        sf.id,
        sf.event_id,
        sf.site_name,
        sf.path,
        sf.title,
        sf.display_url,
        sf.snippet,
        sf.status,
        sf.created_at,
        sf.updated_at,
        e.title AS event_title,
        '' AS event_description,
        CASE
          WHEN ? IS NOT NULL AND se.title_embedding IS NOT NULL
          THEN vector_distance_cos(se.title_embedding, vector32(?))
          ELSE NULL
        END AS title_distance,
        CASE
          WHEN ? IS NOT NULL AND se.description_embedding IS NOT NULL
          THEN vector_distance_cos(se.description_embedding, vector32(?))
          ELSE NULL
        END AS description_distance,
        CASE
          WHEN ? IS NOT NULL AND se.site_name_embedding IS NOT NULL
          THEN vector_distance_cos(se.site_name_embedding, vector32(?))
          ELSE NULL
        END AS site_name_distance
      FROM site_files sf
      INNER JOIN events e ON e.id = sf.event_id
      LEFT JOIN site_embeddings se
        ON se.site_file_id = sf.id
        AND se.status = 'complete'
      WHERE ${whereClause}
      ORDER BY sf.updated_at DESC, sf.id DESC
    `;

  const args: any[] = scope === "my_events" && userId 
    ? [vectorJson, vectorJson, vectorJson, vectorJson, vectorJson, vectorJson, userId]
    : [vectorJson, vectorJson, vectorJson, vectorJson, vectorJson, vectorJson];

  const result = await client.execute({
    sql: sqlQuery,
    args: args,
  });

  return result.rows.map((row) => {
    const site = {
      id: Number(row.id),
      eventId: String(row.event_id),
      siteName: String(row.site_name),
      path: String(row.path),
      title: String(row.title),
      displayUrl: String(row.display_url),
      snippet: String(row.snippet),
      status: String(row.status),
      createdAt: new Date(Number(row.created_at) * 1000),
      updatedAt: new Date(Number(row.updated_at) * 1000),
      eventTitle: String(row.event_title),
      eventDescription: String(row.event_description),
    } as SearchableSite;

    const hasDistances =
      row.title_distance !== null &&
      row.description_distance !== null &&
      row.site_name_distance !== null;
    if (!hasDistances) return { site, semantic: null };

    const title = 1 - Number(row.title_distance);
    const description = 1 - Number(row.description_distance);
    const siteName = 1 - Number(row.site_name_distance);
    const titleWeighted = title * 1.5;
    const descriptionWeighted = description * 1.0;
    const siteNameWeighted = siteName * 1.25;
    return {
      site,
      semantic: {
        titleSimilarity: title,
        descriptionSimilarity: description,
        siteNameSimilarity: siteName,
        titleWeighted,
        descriptionWeighted,
        siteNameWeighted,
        semantic: titleWeighted + descriptionWeighted + siteNameWeighted,
      } satisfies SemanticScore,
    };
  });
}

export async function globalSearch(query: string, scope: "global" | "my_events" = "global", userId?: string) {
  const startedAt = nowMs();
  const cfg = getConfig();
  const normalized = query.trim();

  if (!cfg.embeddings.enabled || !normalized) {
    const sites = await listSearchableSites(scope, userId);
    return { results: fallbackSearch(normalized, sites), mode: "fallback" as const };
  }

  try {
    const queryVector = await createEmbedding(normalized);
    const queryEmbeddedAt = nowMs();
    let rows: Awaited<ReturnType<typeof listSearchableSitesWithScores>>;
    try {
      rows = await listSearchableSitesWithScores(queryVector, scope, userId);
    } catch (err) {
      console.warn("Native vector search failed; falling back to lexical search.", err);
      rows = (await listSearchableSites(scope, userId)).map((site) => ({ site, semantic: null }));
    }
    const vectorScoredAt = nowMs();
    const missingVectorSites = rows.filter((row) => !row.semantic).map((row) => row.site);
    if (missingVectorSites.length > 0) {
      void Promise.all(missingVectorSites.map((site) => refreshSiteEmbedding(site)));
    }

    const ranked = rows.map(({ site, semantic: vectorSemantic }) => {
      const lexical = lexicalScore(normalized, site);
      const lexicalWeighted = lexical * LEXICAL_WEIGHT;
      const semantic = vectorSemantic ?? {
        titleSimilarity: 0,
        descriptionSimilarity: 0,
        siteNameSimilarity: 0,
        titleWeighted: 0,
        descriptionWeighted: 0,
        siteNameWeighted: 0,
        semantic: 0,
      };
      return {
        eventId: site.eventId,
        siteFileId: site.id,
        siteName: site.siteName,
        title: site.title,
        displayUrl: site.displayUrl,
        snippet: site.snippet,
        score: lexicalWeighted + semantic.semantic,
        eventTitle: site.eventTitle,
        debug: {
          lexicalRaw: lexical,
          lexicalWeighted,
          ...semantic,
        },
      };
    });

    console.log("Global search timings", {
      query: normalized,
      scope,
      userId: userId?.substring(0, 8),
      sites: rows.length,
      missingVectorSites: missingVectorSites.length,
      queryEmbeddingMs: queryEmbeddedAt - startedAt,
      vectorScoreMs: vectorScoredAt - queryEmbeddedAt,
      totalMs: nowMs() - startedAt,
    });

    return {
      results: ranked
        .filter(item => item.score >= cfg.search.min_score)
        .sort((left, right) => right.score - left.score),
      mode: "embeddings" as const,
    };
  } catch {
    const sites = await listSearchableSites(scope, userId);
    return { results: fallbackSearch(normalized, sites), mode: "fallback" as const };
  }
}
