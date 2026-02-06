<script setup lang="ts">
import { useFeedback } from "../composables/useFeedback";
import { useReviewData } from "../composables/useReviewData";
import FeedbackList from "./FeedbackList.vue";
import FeedbackPreview from "./FeedbackPreview.vue";

const {
  feedbackItems,
  generalFeedback,
  removeItem,
  previewText,
  isSubmitting,
  submitError,
  isSubmitted,
  submitFeedback,
} = useFeedback();

const { feedbackEndpoint } = useReviewData();

async function handleApprove() {
  if (!feedbackEndpoint.value) return;
  await submitFeedback("approve", feedbackEndpoint.value);
}

async function handleRequestChanges() {
  if (!feedbackEndpoint.value) return;
  await submitFeedback("request_changes", feedbackEndpoint.value);
}
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

        <v-alert
          v-if="submitError"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-4"
          data-testid="submit-error"
        >
          {{ submitError }}
        </v-alert>

        <v-alert
          v-if="isSubmitted"
          type="success"
          variant="tonal"
          density="compact"
          class="mt-4"
          data-testid="submit-success"
        >
          Feedback submitted successfully. You can close this page.
        </v-alert>

        <div v-if="feedbackEndpoint && !isSubmitted" class="feedback-actions mt-4">
          <v-btn
            color="success"
            variant="elevated"
            :loading="isSubmitting"
            :disabled="isSubmitting"
            data-testid="approve-btn"
            @click="handleApprove"
          >
            Approve
          </v-btn>
          <v-btn
            color="warning"
            variant="elevated"
            :loading="isSubmitting"
            :disabled="isSubmitting"
            data-testid="request-changes-btn"
            @click="handleRequestChanges"
          >
            Request Changes
          </v-btn>
        </div>
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

.feedback-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}
</style>
