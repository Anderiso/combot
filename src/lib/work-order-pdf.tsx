import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import type { WorkOrderItem } from "@/lib/work-order-persist";

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 11,
    fontFamily: "Helvetica",
    lineHeight: 1.5,
    color: "#111",
  },
  title: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 11,
    color: "#444",
    marginBottom: 24,
  },
  orderBlock: {
    marginBottom: 28,
  },
  orderHeader: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  fileName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 10,
    color: "#333",
  },
  label: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#555",
    marginTop: 8,
    marginBottom: 3,
  },
  bodyText: {
    fontSize: 11,
    marginBottom: 4,
  },
  notes: {
    fontSize: 11,
    fontStyle: "italic",
    color: "#333",
  },
  pageBreak: {
    marginTop: 12,
  },
});

function OrderSection({
  item,
  index,
  total,
}: {
  item: WorkOrderItem;
  index: number;
  total: number;
}) {
  return (
    <View style={styles.orderBlock} break={index > 0}>
      <Text style={styles.orderHeader}>
        Work order {index + 1} of {total}
      </Text>
      <Text style={styles.fileName}>
        Reference video file: {item.videoFileName}
      </Text>

      <Text style={styles.label}>Hook A (original)</Text>
      <Text style={styles.bodyText}>{item.hook1}</Text>

      <Text style={styles.label}>Hook B</Text>
      <Text style={styles.bodyText}>{item.hook2}</Text>

      <Text style={styles.label}>Hook C</Text>
      <Text style={styles.bodyText}>{item.hook3}</Text>

      <Text style={styles.label}>Body</Text>
      <Text style={styles.bodyText}>{item.body}</Text>

      {item.notes.trim() ? (
        <>
          <Text style={styles.label}>Notes</Text>
          <Text style={styles.notes}>{item.notes.trim()}</Text>
        </>
      ) : null}
    </View>
  );
}

function WorkOrderDocument({
  items,
  brandName,
}: {
  items: WorkOrderItem[];
  brandName?: string;
}) {
  const dateLabel = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Video work orders</Text>
        <Text style={styles.subtitle}>
          {brandName ? `${brandName} · ` : ""}
          {dateLabel} · {items.length} video{items.length === 1 ? "" : "s"}
        </Text>
        <Text style={styles.bodyText}>
          Match each script below to its reference video using the filename shown.
          Reference video files are sent separately with this work order document.
        </Text>

        {items.map((item, index) => (
          <OrderSection
            key={item.id}
            item={item}
            index={index}
            total={items.length}
          />
        ))}
      </Page>
    </Document>
  );
}

export async function downloadWorkOrdersPdf(
  items: WorkOrderItem[],
  brandName?: string
): Promise<void> {
  const ready = items.filter((item) => item.status === "ready");
  if (ready.length === 0) {
    throw new Error("No ready work orders to export.");
  }

  const blob = await pdf(
    <WorkOrderDocument items={ready} brandName={brandName} />
  ).toBlob();

  const dateStamp = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `work-orders-${dateStamp}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
