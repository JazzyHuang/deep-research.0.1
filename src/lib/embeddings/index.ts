/**
 * Vector Embeddings Module
 * 
 * Provides semantic vector embeddings for papers and queries,
 * enabling semantic search and similarity-based paper retrieval.
 * Uses OpenAI text-embedding-3-small via OpenRouter for cost-efficiency.
 */

import type { Paper } from '@/types/paper';

// ============================================
// Types
// ============================================

/**
 * Configuration for embedding generation
 */
export interface EmbeddingConfig {
  model: string;
  dimensions: number;
  batchSize: number;
  maxRetries: number;
  retryDelay: number;
}

/**
 * A paper with its embedding vector
 */
export interface EmbeddedPaper {
  paperId: string;
  embedding: number[];
  text: string;  // Text that was embedded
  createdAt: number;
}

/**
 * Similarity search result
 */
export interface SimilarityResult {
  paperId: string;
  paper?: Paper;
  similarity: number;  // 0-1, higher is more similar
}

/**
 * Batch embedding result
 */
export interface BatchEmbeddingResult {
  embeddings: Map<string, number[]>;
  failed: string[];
  totalTokens: number;
}

// ============================================
// Configuration
// ============================================

const DEFAULT_CONFIG: EmbeddingConfig = {
  model: 'openai/text-embedding-3-small',
  dimensions: 1536,
  batchSize: 20,
  maxRetries: 3,
  retryDelay: 1000,
};

// ============================================
// Core Functions
// ============================================

/**
 * Generate embedding for a single text using OpenRouter
 */
export async function generateEmbedding(
  text: string,
  config: Partial<EmbeddingConfig> = {},
): Promise<number[]> {
  const settings = { ...DEFAULT_CONFIG, ...config };
  
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  // Truncate text if too long (embedding models have token limits)
  const truncatedText = text.slice(0, 8000);

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < settings.maxRetries; attempt++) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'Deep Research',
        },
        body: JSON.stringify({
          model: settings.model,
          input: truncatedText,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Embedding API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.data?.[0]?.embedding) {
        throw new Error('Invalid embedding response format');
      }

      return data.data[0].embedding;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < settings.maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, settings.retryDelay * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error('Failed to generate embedding');
}

/**
 * Generate embeddings for multiple texts in batches
 */
export async function generateEmbeddingsBatch(
  texts: Array<{ id: string; text: string }>,
  config: Partial<EmbeddingConfig> = {},
): Promise<BatchEmbeddingResult> {
  const settings = { ...DEFAULT_CONFIG, ...config };
  
  const embeddings = new Map<string, number[]>();
  const failed: string[] = [];
  let totalTokens = 0;

  // Process in batches
  for (let i = 0; i < texts.length; i += settings.batchSize) {
    const batch = texts.slice(i, i + settings.batchSize);
    
    // Process batch items in parallel
    const results = await Promise.allSettled(
      batch.map(async ({ id, text }) => {
        const embedding = await generateEmbedding(text, settings);
        return { id, embedding };
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        embeddings.set(result.value.id, result.value.embedding);
        // Rough token estimate: ~4 chars per token
        totalTokens += Math.ceil(texts.find(t => t.id === result.value.id)?.text.length || 0 / 4);
      } else {
        const failedItem = batch[results.indexOf(result)];
        failed.push(failedItem.id);
        console.error(`Failed to embed ${failedItem.id}:`, result.reason);
      }
    }

    // Small delay between batches to avoid rate limits
    if (i + settings.batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return { embeddings, failed, totalTokens };
}

/**
 * Generate embedding text for a paper
 * Combines title and abstract for best semantic representation
 */
export function getPaperEmbeddingText(paper: Paper): string {
  const parts: string[] = [paper.title];
  
  if (paper.abstract) {
    parts.push(paper.abstract);
  }
  
  // Add keywords/subjects if available
  if (paper.subjects && paper.subjects.length > 0) {
    parts.push(`Keywords: ${paper.subjects.slice(0, 10).join(', ')}`);
  }

  return parts.join('\n\n');
}

/**
 * Embed multiple papers
 */
export async function embedPapers(
  papers: Paper[],
  config: Partial<EmbeddingConfig> = {},
): Promise<Map<string, number[]>> {
  const texts = papers.map(paper => ({
    id: paper.id,
    text: getPaperEmbeddingText(paper),
  }));

  const result = await generateEmbeddingsBatch(texts, config);
  
  if (result.failed.length > 0) {
    console.warn(`Failed to embed ${result.failed.length} papers:`, result.failed);
  }

  return result.embeddings;
}

/**
 * Embed a search query for semantic matching
 */
export async function embedQuery(
  query: string,
  config: Partial<EmbeddingConfig> = {},
): Promise<number[]> {
  return generateEmbedding(query, config);
}

// ============================================
// Similarity Functions
// ============================================

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  
  if (magnitude === 0) return 0;
  
  return dotProduct / magnitude;
}

/**
 * Calculate Euclidean distance between two vectors
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Find most similar papers to a query embedding
 */
export function findSimilarByEmbedding(
  queryEmbedding: number[],
  paperEmbeddings: Map<string, number[]>,
  papers: Paper[],
  limit: number = 10,
  minSimilarity: number = 0.5,
): SimilarityResult[] {
  const results: SimilarityResult[] = [];

  for (const [paperId, embedding] of paperEmbeddings) {
    const similarity = cosineSimilarity(queryEmbedding, embedding);
    
    if (similarity >= minSimilarity) {
      results.push({
        paperId,
        paper: papers.find(p => p.id === paperId),
        similarity,
      });
    }
  }

  // Sort by similarity descending
  results.sort((a, b) => b.similarity - a.similarity);

  return results.slice(0, limit);
}

/**
 * Find papers similar to a query string
 */
export async function findSimilarPapers(
  query: string,
  papers: Paper[],
  paperEmbeddings?: Map<string, number[]>,
  limit: number = 10,
  config: Partial<EmbeddingConfig> = {},
): Promise<SimilarityResult[]> {
  // Generate query embedding
  const queryEmbedding = await embedQuery(query, config);

  // Generate paper embeddings if not provided
  const embeddings = paperEmbeddings || await embedPapers(papers, config);

  return findSimilarByEmbedding(queryEmbedding, embeddings, papers, limit);
}

/**
 * Find papers similar to a given paper
 */
export async function findRelatedPapers(
  paper: Paper,
  allPapers: Paper[],
  paperEmbeddings?: Map<string, number[]>,
  limit: number = 5,
  config: Partial<EmbeddingConfig> = {},
): Promise<SimilarityResult[]> {
  // Get or generate embeddings
  const embeddings = paperEmbeddings || await embedPapers(allPapers, config);

  // Get source paper embedding
  let sourceEmbedding = embeddings.get(paper.id);
  
  if (!sourceEmbedding) {
    sourceEmbedding = await generateEmbedding(getPaperEmbeddingText(paper), config);
  }

  // Find similar papers (excluding the source)
  const results = findSimilarByEmbedding(
    sourceEmbedding,
    embeddings,
    allPapers.filter(p => p.id !== paper.id),
    limit + 1, // Get one extra in case source is included
  );

  return results.filter(r => r.paperId !== paper.id).slice(0, limit);
}

// ============================================
// Clustering Functions
// ============================================

/**
 * Simple K-means clustering for papers
 * Returns paper IDs grouped by cluster
 */
export function clusterPapersByEmbedding(
  paperEmbeddings: Map<string, number[]>,
  k: number = 5,
  maxIterations: number = 100,
): Map<number, string[]> {
  const paperIds = Array.from(paperEmbeddings.keys());
  const embeddings = paperIds.map(id => paperEmbeddings.get(id)!);
  
  if (paperIds.length < k) {
    // Not enough papers for k clusters
    const clusters = new Map<number, string[]>();
    clusters.set(0, paperIds);
    return clusters;
  }

  // Initialize centroids randomly
  const centroids: number[][] = [];
  const shuffled = [...paperIds].sort(() => Math.random() - 0.5);
  for (let i = 0; i < k; i++) {
    centroids.push([...paperEmbeddings.get(shuffled[i])!]);
  }

  let assignments = new Array(paperIds.length).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign each paper to nearest centroid
    const newAssignments = embeddings.map(embedding => {
      let minDist = Infinity;
      let minCluster = 0;
      
      for (let c = 0; c < k; c++) {
        const dist = euclideanDistance(embedding, centroids[c]);
        if (dist < minDist) {
          minDist = dist;
          minCluster = c;
        }
      }
      
      return minCluster;
    });

    // Check for convergence
    if (JSON.stringify(assignments) === JSON.stringify(newAssignments)) {
      break;
    }
    
    assignments = newAssignments;

    // Update centroids
    for (let c = 0; c < k; c++) {
      const clusterEmbeddings = embeddings.filter((_, i) => assignments[i] === c);
      
      if (clusterEmbeddings.length > 0) {
        const dim = clusterEmbeddings[0].length;
        const newCentroid = new Array(dim).fill(0);
        
        for (const emb of clusterEmbeddings) {
          for (let d = 0; d < dim; d++) {
            newCentroid[d] += emb[d];
          }
        }
        
        for (let d = 0; d < dim; d++) {
          newCentroid[d] /= clusterEmbeddings.length;
        }
        
        centroids[c] = newCentroid;
      }
    }
  }

  // Build cluster map
  const clusters = new Map<number, string[]>();
  for (let c = 0; c < k; c++) {
    clusters.set(c, []);
  }
  
  for (let i = 0; i < paperIds.length; i++) {
    clusters.get(assignments[i])!.push(paperIds[i]);
  }

  return clusters;
}

// ============================================
// Caching
// ============================================

/**
 * In-memory cache for embeddings
 * For production, consider using Redis or database storage
 */
class EmbeddingCache {
  private cache: Map<string, { embedding: number[]; timestamp: number }> = new Map();
  private maxAge: number = 24 * 60 * 60 * 1000; // 24 hours

  set(key: string, embedding: number[]): void {
    this.cache.set(key, { embedding, timestamp: Date.now() });
  }

  get(key: string): number[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.embedding;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const embeddingCache = new EmbeddingCache();

/**
 * Generate embedding with caching
 */
export async function generateEmbeddingCached(
  text: string,
  config: Partial<EmbeddingConfig> = {},
): Promise<number[]> {
  // Create cache key from text hash
  const key = `emb-${hashString(text)}`;
  
  const cached = embeddingCache.get(key);
  if (cached) {
    return cached;
  }

  const embedding = await generateEmbedding(text, config);
  embeddingCache.set(key, embedding);
  
  return embedding;
}

/**
 * Simple string hashing for cache keys
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}





