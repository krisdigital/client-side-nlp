// https://en.wikipedia.org/wiki/Disjoint-set_data_structure
function groupSimilarVectors(
  similarityMatrix: { data: Float32Array },
  numVectors: number,
  threshold: number = 0.8,
): number[][] {
  const similar: Set<number>[] = Array.from(
    { length: numVectors },
    () => new Set(),
  );

  for (let i = 0; i < numVectors; i++) {
    for (let j = i + 1; j < numVectors; j++) {
      const score = similarityMatrix.data[i * numVectors + j];
      if (score >= threshold) {
        similar[i].add(j);
        similar[j].add(i);
      }
    }
  }

  const parent: number[] = Array.from({ length: numVectors }, (_, i) => i);

  function find(x: number): number {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  }

  function union(x: number, y: number): void {
    parent[find(x)] = find(y);
  }

  for (let i = 0; i < numVectors; i++) {
    for (const j of similar[i]) {
      union(i, j);
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < numVectors; i++) {
    if (similar[i].size > 0) {
      const root = find(i);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root)!.push(i);
    }
  }

  return Array.from(groups.values());
}

export function groupSimilarArticles<T>(
  articles: T[],
  similarityMatrix: { data: Float32Array },
  threshold: number = 0.8,
): T[][] {
  const groups = groupSimilarVectors(
    similarityMatrix,
    articles.length,
    threshold,
  );
  return groups.map((group) => group.map((i) => articles[i]));
}
