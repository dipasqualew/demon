import { ref, computed } from "vue";

export type SubmitVerdict = "approve" | "request_changes";

const feedbackItems = ref<string[]>([]);
const generalFeedback = ref("");
const isSubmitting = ref(false);
const submitError = ref<string | null>(null);
const isSubmitted = ref(false);

export function useFeedback() {
  function addItem(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (feedbackItems.value.includes(trimmed)) return;
    feedbackItems.value.push(trimmed);
  }

  function removeItem(index: number) {
    feedbackItems.value.splice(index, 1);
  }

  function clearAll() {
    feedbackItems.value = [];
    generalFeedback.value = "";
  }

  const previewText = computed(() => {
    const lines: string[] = [];

    feedbackItems.value.forEach((item, i) => {
      lines.push(`${i + 1}. Address: ${item}`);
    });

    const general = generalFeedback.value.trim();
    if (general) {
      if (lines.length > 0) {
        lines.push("");
      }
      lines.push("General feedback:");
      lines.push(general);
    }

    return lines.join("\n");
  });

  async function submitFeedback(verdict: SubmitVerdict, endpoint: string): Promise<boolean> {
    isSubmitting.value = true;
    submitError.value = null;

    try {
      const body: { verdict: SubmitVerdict; feedback?: string } = { verdict };

      if (verdict === "request_changes") {
        const feedback = previewText.value.trim();
        if (feedback) {
          body.feedback = feedback;
        }
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? `Failed with status ${response.status}`);
      }

      isSubmitted.value = true;
      return true;
    } catch (err) {
      submitError.value = err instanceof Error ? err.message : "Unknown error";
      return false;
    } finally {
      isSubmitting.value = false;
    }
  }

  return {
    feedbackItems,
    generalFeedback,
    addItem,
    removeItem,
    clearAll,
    previewText,
    isSubmitting,
    submitError,
    isSubmitted,
    submitFeedback,
  };
}
