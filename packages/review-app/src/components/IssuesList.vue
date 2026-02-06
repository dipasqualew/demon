<script setup lang="ts">
import type { ReviewIssue } from "../types";

defineProps<{
  issues: ReviewIssue[];
}>();

const emit = defineEmits<{
  addFeedback: [description: string];
}>();

function getSeverityColor(severity: string): string {
  switch (severity) {
    case "major":
      return "error";
    case "minor":
      return "warning";
    default:
      return "info";
  }
}

function getBorderColor(severity: string): string {
  switch (severity) {
    case "major":
      return "#dc3545";
    case "minor":
      return "#ffc107";
    default:
      return "#6c757d";
  }
}
</script>

<template>
  <div class="issues-section" data-testid="issues-list">
    <h2 class="text-primary text-h6 mb-2">Issues</h2>

    <div v-if="issues.length === 0" class="text-success font-italic">
      No issues found.
    </div>

    <div
      v-for="(issue, index) in issues"
      :key="index"
      class="issue-item pa-3 mb-2 rounded"
      :style="{
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderLeft: `4px solid ${getBorderColor(issue.severity)}`,
      }"
      data-testid="issue-item"
    >
      <div class="d-flex align-center">
        <v-chip
          :color="getSeverityColor(issue.severity)"
          size="x-small"
          class="mr-2 font-weight-bold"
          label
        >
          {{ issue.severity.toUpperCase() }}
        </v-chip>
        <span class="issue-text flex-grow-1">{{ issue.description }}</span>
        <v-btn
          variant="outlined"
          color="secondary"
          size="x-small"
          class="ml-2"
          data-testid="issue-add-feedback"
          :data-issue="issue.description"
          @click="emit('addFeedback', issue.description)"
        >
          +
        </v-btn>
      </div>
    </div>
  </div>
</template>
