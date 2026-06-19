export type WorkOrderItemStatus = "pending" | "splitting" | "ready" | "error";

export type WorkOrderItem = {
  id: string;
  script: string;
  videoFileName: string;
  googleDriveLink: string;
  notes: string;
  hook1: string;
  hook2: string;
  hook3: string;
  body: string;
  status: WorkOrderItemStatus;
  errorMessage: string | null;
  addedAt: number;
};

export type WorkOrderBatch = {
  items: WorkOrderItem[];
};

export const MAX_WORK_ORDERS = 10;

const STORAGE_KEY = "combot-work-orders";

const EMPTY_BATCH: WorkOrderBatch = { items: [] };

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createWorkOrderItem(params: {
  script: string;
  videoFileName: string;
}): WorkOrderItem {
  return {
    id: createId(),
    script: params.script.trim(),
    videoFileName: params.videoFileName.trim() || "unknown-video.mp4",
    googleDriveLink: "",
    notes: "",
    hook1: "",
    hook2: "",
    hook3: "",
    body: "",
    status: "pending",
    errorMessage: null,
    addedAt: Date.now(),
  };
}

export function loadWorkOrderBatch(): WorkOrderBatch {
  if (typeof window === "undefined") {
    return EMPTY_BATCH;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return EMPTY_BATCH;
    }

    const parsed = JSON.parse(raw) as Partial<WorkOrderBatch>;
    const items = Array.isArray(parsed.items)
      ? parsed.items.map(normalizeItem).slice(0, MAX_WORK_ORDERS)
      : [];

    return { items };
  } catch {
    return EMPTY_BATCH;
  }
}

function normalizeItem(raw: Partial<WorkOrderItem>): WorkOrderItem {
  return {
    id: raw.id ?? createId(),
    script: raw.script ?? "",
    videoFileName: raw.videoFileName?.trim() || "unknown-video.mp4",
    googleDriveLink: raw.googleDriveLink ?? "",
    notes: raw.notes ?? "",
    hook1: raw.hook1 ?? "",
    hook2: raw.hook2 ?? "",
    hook3: raw.hook3 ?? "",
    body: raw.body ?? "",
    status:
      raw.status === "splitting"
        ? "pending"
        : (raw.status ?? "pending"),
    errorMessage: raw.errorMessage ?? null,
    addedAt: raw.addedAt ?? Date.now(),
  };
}

export function saveWorkOrderBatch(batch: WorkOrderBatch): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        items: batch.items.slice(0, MAX_WORK_ORDERS),
      })
    );
  } catch {
    // Quota exceeded — ignore.
  }
}

export function clearWorkOrderBatch(): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
}

export function addWorkOrderItem(params: {
  script: string;
  videoFileName: string;
}): { batch: WorkOrderBatch; item: WorkOrderItem } | { error: string } {
  const batch = loadWorkOrderBatch();

  if (batch.items.length >= MAX_WORK_ORDERS) {
    return { error: `Batch is full (${MAX_WORK_ORDERS} max). Remove one before adding.` };
  }

  if (!params.script.trim()) {
    return { error: "Script is empty." };
  }

  const item = createWorkOrderItem(params);
  const next = { items: [...batch.items, item] };
  saveWorkOrderBatch(next);

  return { batch: next, item };
}

export function updateWorkOrderItem(
  id: string,
  patch: Partial<
    Pick<
      WorkOrderItem,
      | "notes"
      | "googleDriveLink"
      | "hook1"
      | "hook2"
      | "hook3"
      | "body"
      | "status"
      | "errorMessage"
      | "script"
      | "videoFileName"
    >
  >
): WorkOrderBatch {
  const batch = loadWorkOrderBatch();
  const next = {
    items: batch.items.map((item) =>
      item.id === id ? { ...item, ...patch } : item
    ),
  };
  saveWorkOrderBatch(next);
  return next;
}

export function removeWorkOrderItem(id: string): WorkOrderBatch {
  const batch = loadWorkOrderBatch();
  const next = { items: batch.items.filter((item) => item.id !== id) };
  saveWorkOrderBatch(next);
  return next;
}
