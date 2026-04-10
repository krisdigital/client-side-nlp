import { matmul, Tensor } from "@huggingface/transformers";

self.onmessage = async (event: MessageEvent<number[][]>) => {
  const vectors = event.data;
  const flattened = new Float32Array(vectors.flat());
  const numVectors = vectors.length;
  const dims = vectors[0].length;

  const matrix = new Tensor("float32", flattened, [numVectors, dims]);
  const transposed = matrix.transpose(1, 0);

  const similarityMatrix = await matmul(matrix, transposed);
  matrix.dispose();
  transposed.dispose();

  const result = similarityMatrix.data;
  const simDims = similarityMatrix.dims;
  similarityMatrix.dispose();

  self.postMessage(
    { data: result, dims: simDims, numVectors },
    { transfer: [(result as Float32Array).buffer] },
  );
};
