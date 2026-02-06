<script setup lang="ts">
import { ref } from "vue";

defineProps<{
  previewText: string;
}>();

const copyButtonText = ref("Copy to clipboard");
const isCopied = ref(false);

async function copyToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    }
  } catch {
    // Silently fail
  }

  isCopied.value = true;
  copyButtonText.value = "Copied!";

  setTimeout(() => {
    isCopied.value = false;
    copyButtonText.value = "Copy to clipboard";
  }, 1500);
}
</script>

<template>
  <div class="feedback-preview-section">
    <h2 class="text-primary text-subtitle-1 font-weight-bold mb-2">Preview</h2>
    <pre
      class="feedback-preview pa-4 rounded"
      id="feedback-preview"
      data-testid="feedback-preview"
    >{{ previewText }}</pre>
    <div class="d-flex justify-end mt-2">
      <v-btn
        variant="outlined"
        color="secondary"
        size="small"
        id="feedback-copy"
        data-testid="feedback-copy"
        @click="copyToClipboard(previewText)"
      >
        {{ copyButtonText }}
      </v-btn>
    </div>
  </div>
</template>

<style scoped>
.feedback-preview {
  background: #0f0f23;
  color: #ccc;
  border: 1px solid #0f3460;
  white-space: pre-wrap;
  font-size: 0.85rem;
  line-height: 1.5;
  min-height: 200px;
  overflow-y: auto;
  font-family: inherit;
}
</style>
