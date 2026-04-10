import { useEffect } from "preact/hooks";
import "./app.css";
import { computed, effect, signal } from "@preact/signals";
import { groupSimilarArticles } from "./similarity";

const pageStore = signal<Page | undefined>();
const scheduledStore = signal<number[]>([]);
const clusterStore = signal<Article[][]>([]);
const similarityValueStore = signal<number>(0.5);
const currentPageStore = signal<string>("http://localhost:5174/data/2");
const statusStore = signal<"loading" | "infering" | "clustering" | "done">(
  "done",
);

let cachedSimData: Float32Array<ArrayBufferLike> | undefined;

const embeddingProgress = computed(() => {
  const page = pageStore.value;
  if (!page) return 0;
  const total = page.feed_items.length;
  if (total === 0) return 0;
  const done = page.feed_items.filter((a) => a.vector).length;
  return Math.round((done / total) * 100);
});

const inferWorker = new Worker(new URL("inferworker.ts", import.meta.url), {
  type: "module",
});

const simWorker = new Worker(new URL("simworker.ts", import.meta.url), {
  type: "module",
});

type InferResult = {
  id: number;
  vector: number[];
};

inferWorker.onmessage = (event) => {
  const result: InferResult[] = event.data;
  if (!pageStore.value) return;

  const getVector = (id: number) => result.find((r) => r.id === id)?.vector;

  pageStore.value = {
    ...pageStore.value,
    feed_items: [
      ...pageStore.value.feed_items.map((fi) => {
        const vector = getVector(fi.id);
        if (vector) {
          return { ...fi, vector };
        }
        return fi;
      }),
    ],
  };

  if (!pageStore.value.feed_items.find((a) => !a.vector)) {
    const items = pageStore.value.feed_items.map((a) => a.vector);
    statusStore.value = "clustering";
    simWorker.postMessage(items);
  }
};

simWorker.onmessage = (event) => {
  if (!pageStore.value) return;
  const { data } = event.data;
  cachedSimData = data;
  clusterStore.value = groupSimilarArticles(
    pageStore.value.feed_items,
    {
      data,
    },
    similarityValueStore.peek(),
  );
  statusStore.value = "done";
};

effect(() => {
  if (pageStore.value) {
    const items = pageStore.value.feed_items
      .filter((i) => !i.vector && !scheduledStore.peek().includes(i.id))
      .map((i) => ({ id: i.id, text: i.description }));
    scheduledStore.value = [
      ...scheduledStore.peek(),
      ...items.map((i) => i.id),
    ];
    if (items.length > 0) {
      inferWorker.postMessage(items);
      statusStore.value = "infering";
    }
  }
});

type Article = {
  id: number;
  title: string;
  link: string;
  description: string;
  vector?: number[];
};

type Page = {
  title: string;
  id: number;
  feed_items: Article[];
};

export function App() {
  const getPage = async (url: string) => {
    let response = await fetch(url);
    let page: Page = await response.json();
    pageStore.value = page;
  };

  useEffect(() => {
    statusStore.value = "loading";
    getPage(currentPageStore.value);
  }, [currentPageStore.value]);

  if (!pageStore.value) {
    return <h1>Loading...</h1>;
  }

  if (statusStore.value !== "done") {
    let statusName = "";
    switch (statusStore.value) {
      case "clustering":
        statusName = "Clustering";
        break;
      case "infering":
        statusName = "Infering";
        break;
      default:
        statusName = "Slacking";
    }
    return (
      <>
        <h1>
          {statusName}... {pageStore.value.title}
        </h1>
        {statusStore.value === "infering" && (
          <>
            <progress value={embeddingProgress.value} max={100} />
            <span>{embeddingProgress.value}%</span>
          </>
        )}
      </>
    );
  }

  return (
    <>
      <input
        type="text"
        defaultValue={currentPageStore.value}
        onChange={(e) => {
          currentPageStore.value = e.currentTarget.value;
          pageStore.value = undefined;
          clusterStore.value = [];
          scheduledStore.value = [];
          cachedSimData = undefined;
        }}
      />
      <h1>{pageStore.value.title}</h1>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={similarityValueStore.value}
        onInput={(e) => {
          if (!pageStore.value || !e.currentTarget || !cachedSimData) return;
          const value = parseFloat(e.currentTarget.value);
          similarityValueStore.value = value;

          clusterStore.value = groupSimilarArticles(
            pageStore.value.feed_items,
            {
              data: cachedSimData,
            },
            value,
          );
        }}
      />
      <p>{similarityValueStore.value}</p>
      {clusterStore.value.map((c) => (
        <div class="cluster">
          {c.map((a) => (
            <article>
              <h2>
                <a href={a.link}>{a.title}</a>
              </h2>
              <p dangerouslySetInnerHTML={{ __html: a.description }} />
            </article>
          ))}
        </div>
      ))}
    </>
  );
}
