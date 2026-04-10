import {
  pipeline,
  env,
  FeatureExtractionPipeline,
} from "@huggingface/transformers";

env.allowLocalModels = false;

type QueueJob = {
  id: number;
  text: string;
};

let extractor: FeatureExtractionPipeline | undefined;
let isPreparing = false;
let queue: QueueJob[][] = [];

self.onmessage = async (event: MessageEvent<QueueJob[]>) => {
  const jobs: QueueJob[] = event.data;

  if (extractor) {
    runInference(jobs);
    return;
  }

  if (isPreparing) {
    queue.push(jobs);
    return;
  }

  isPreparing = true;
  const device = (await (navigator as any).gpu?.requestAdapter())
    ? "webgpu"
    : "wasm";

  extractor = await pipeline(
    "feature-extraction",
    "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
    //"Xenova/all-MiniLM-L6-v2",
    {
      device,
      dtype: "fp32",
      //dtype: "q4f16",
      progress_callback: (data) => {
        if (data.status === "download") {
          console.log(`Downloading ${data.file}`);
        } else if (data.status === "initiate") {
          console.log(`Initiating ${data.file}`);
        } else if (data.status === "progress") {
          console.log(`${data.file}: ${Math.round(data.progress)}%`);
        } else if (data.status === "done") {
          console.log(`Done loading ${data.file}`);
        } else if (data.status === "ready") {
          console.log(`Model ready!`);
        }
      },
    },
  );

  isPreparing = false;

  runInference(jobs);
  queue.forEach((jobs) => runInference(jobs));
  queue = [];
};

async function runInference(jobs: QueueJob[]) {
  if (!extractor) return;
  const texts = jobs.map((j) => j.text);
  const ids = jobs.map((j) => j.id);
  const output = await extractor(texts, { pooling: "mean", normalize: true });
  const vectors = output.tolist();
  const results = ids.map((id, i) => ({
    id,
    vector: vectors[i],
  }));
  self.postMessage(results);
}
