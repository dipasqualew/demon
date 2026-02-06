import { ref, computed } from "vue";

const feedbackItems = ref<string[]>([]);
const generalFeedback = ref("");

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

  return {
    feedbackItems,
    generalFeedback,
    addItem,
    removeItem,
    clearAll,
    previewText,
  };
}
