<script setup lang="ts">
import { useFeedback } from "../composables/useFeedback";
import FeedbackList from "./FeedbackList.vue";
import FeedbackPreview from "./FeedbackPreview.vue";

const { feedbackItems, generalFeedback, removeItem, previewText } =
  useFeedback();
</script>

<template>
  <div class="feedback-tab" id="tab-feedback" data-testid="feedback-tab">
    <div class="feedback-layout pa-6">
      <div class="feedback-left">
        <h2 class="text-primary text-subtitle-1 font-weight-bold mb-2">
          Feedback Items
        </h2>
        <FeedbackList :items="feedbackItems" @remove="removeItem" />

        <h2 class="text-primary text-subtitle-1 font-weight-bold mt-4 mb-2">
          General Feedback
        </h2>
        <v-textarea
          v-model="generalFeedback"
          variant="outlined"
          density="compact"
          placeholder="Add general feedback here..."
          rows="4"
          auto-grow
          hide-details
          bg-color="surface"
          id="feedback-general"
          data-testid="feedback-general"
        />
      </div>
      <div class="feedback-right">
        <FeedbackPreview :preview-text="previewText" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.feedback-layout {
  display: flex;
  gap: 1.5rem;
}

.feedback-left {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.feedback-right {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
</style>
