<script setup lang="ts">
import { ref, computed } from "vue";
import { useReviewData } from "./composables/useReviewData";
import ReviewHeader from "./components/ReviewHeader.vue";
import TabNavigation from "./components/TabNavigation.vue";
import SummaryTab from "./components/SummaryTab.vue";
import DemosTab from "./components/DemosTab.vue";
import FeedbackTab from "./components/FeedbackTab.vue";

const { title, hasReview } = useReviewData();

const activeTab = ref(hasReview.value ? "summary" : "demos");

const tabs = computed(() => {
  const result = [];
  if (hasReview.value) {
    result.push({ id: "summary", label: "Summary" });
  }
  result.push({ id: "demos", label: "Demos" });
  if (hasReview.value) {
    result.push({ id: "feedback", label: "Feedback" });
  }
  return result;
});
</script>

<template>
  <v-app>
    <ReviewHeader :title="title" />
    <TabNavigation v-model="activeTab" :tabs="tabs" />
    <v-main>
      <SummaryTab v-if="activeTab === 'summary' && hasReview" />
      <DemosTab v-if="activeTab === 'demos'" />
      <FeedbackTab v-if="activeTab === 'feedback' && hasReview" />
    </v-main>
  </v-app>
</template>

<style>
html,
body {
  margin: 0;
  padding: 0;
  font-family: system-ui, -apple-system, sans-serif;
}

.v-application {
  background: #1a1a2e !important;
}
</style>
