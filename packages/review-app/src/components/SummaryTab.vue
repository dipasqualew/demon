<script setup lang="ts">
import { useReviewData } from "../composables/useReviewData";
import { useFeedback } from "../composables/useFeedback";
import VerdictBanner from "./VerdictBanner.vue";
import HighlightsList from "./HighlightsList.vue";
import IssuesList from "./IssuesList.vue";
import SelectionButton from "./SelectionButton.vue";

const { review } = useReviewData();
const { addItem } = useFeedback();
</script>

<template>
  <div v-if="review" class="summary-tab pa-6" id="tab-summary" data-testid="summary-tab">
    <VerdictBanner :verdict="review.verdict" :reason="review.verdictReason" />

    <div class="review-body mt-4" style="max-width: 900px">
      <h2 class="text-primary text-h6 mb-2">Summary</h2>
      <p class="text-grey-lighten-1 mb-4">{{ review.summary }}</p>

      <HighlightsList :highlights="review.highlights" />

      <div class="mt-4">
        <IssuesList :issues="review.issues" @add-feedback="addItem" />
      </div>
    </div>

    <SelectionButton container-id="tab-summary" @add-feedback="addItem" />
  </div>
</template>
