<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const props = defineProps<{
  containerId: string;
}>();

const emit = defineEmits<{
  addFeedback: [text: string];
}>();

const isVisible = ref(false);
const buttonX = ref(0);
const buttonY = ref(0);
const selectedText = ref("");

let selectionTimeout: ReturnType<typeof setTimeout> | null = null;

function handleMouseUp(e: MouseEvent) {
  if (selectionTimeout) {
    clearTimeout(selectionTimeout);
  }

  selectionTimeout = setTimeout(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";

    if (!text) {
      return;
    }

    const anchor = sel?.anchorNode;
    let node: Node | null = anchor ?? null;
    let inContainer = false;

    while (node) {
      if (node instanceof HTMLElement && node.id === props.containerId) {
        inContainer = true;
        break;
      }
      node = node.parentNode;
    }

    if (!inContainer) {
      return;
    }

    selectedText.value = text;
    buttonX.value = e.pageX;
    buttonY.value = e.pageY - 35;
    isVisible.value = true;
  }, 100);
}

function handleMouseDown(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest("[data-testid='selection-button']")) {
    isVisible.value = false;
  }
}

function handleClick() {
  if (selectedText.value) {
    emit("addFeedback", selectedText.value);
  }
  isVisible.value = false;
  window.getSelection()?.removeAllRanges();
}

onMounted(() => {
  document.addEventListener("mouseup", handleMouseUp);
  document.addEventListener("mousedown", handleMouseDown);
});

onUnmounted(() => {
  document.removeEventListener("mouseup", handleMouseUp);
  document.removeEventListener("mousedown", handleMouseDown);
  if (selectionTimeout) {
    clearTimeout(selectionTimeout);
  }
});
</script>

<template>
  <Teleport to="body">
    <v-btn
      v-if="isVisible"
      color="primary"
      size="small"
      :style="{
        position: 'absolute',
        left: buttonX + 'px',
        top: buttonY + 'px',
        zIndex: 1000,
      }"
      data-testid="selection-button"
      id="feedback-selection-btn"
      @click="handleClick"
    >
      Add to feedback
    </v-btn>
  </Teleport>
</template>
