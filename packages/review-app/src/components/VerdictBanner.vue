<script setup lang="ts">
import type { ReviewVerdict } from "../types";

const props = defineProps<{
  verdict: ReviewVerdict;
  reason: string;
}>();

const isApproved = props.verdict === "approve";
const label = isApproved ? "Approved" : "Changes Requested";
</script>

<template>
  <v-alert
    :type="isApproved ? 'success' : 'error'"
    variant="tonal"
    density="comfortable"
    data-testid="verdict-banner"
  >
    <strong>{{ label }}</strong>: {{ reason }}
  </v-alert>
</template>
