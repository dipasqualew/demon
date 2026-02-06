<script setup lang="ts">
import type { DemoStep } from "../types";

defineProps<{
  steps: DemoStep[];
  activeStepIndex: number;
  hoveredStepIndex: number;
}>();

const emit = defineEmits<{
  seek: [timestampSeconds: number];
  "hover-enter": [timestampSeconds: number, index: number];
  "hover-leave": [];
}>();

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}
</script>

<template>
  <div class="steps-section" data-testid="steps-list" id="steps-section">
    <h2 class="text-primary text-subtitle-1 font-weight-bold mb-2">Steps</h2>
    <v-list density="compact" bg-color="transparent" id="steps-list">
      <v-list-item
        v-for="(step, index) in steps"
        :key="index"
        :active="index === activeStepIndex"
        color="primary"
        class="step-item pa-1"
        :class="{
          'step-active': index === activeStepIndex,
          'step-hovered': index === hoveredStepIndex,
        }"
        :data-time="step.timestampSeconds"
        @click="emit('seek', step.timestampSeconds)"
        @mouseenter="emit('hover-enter', step.timestampSeconds, index)"
        @mouseleave="emit('hover-leave')"
      >
        <span class="timestamp text-primary font-weight-bold mr-2">
          {{ formatTime(step.timestampSeconds) }}
        </span>
        <span class="text-secondary">{{ step.text }}</span>
      </v-list-item>
    </v-list>
  </div>
</template>

<style scoped>
.step-item {
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: all 0.2s;
}

.step-item:hover {
  color: #e94560 !important;
}

.step-active,
.step-hovered {
  background: rgba(233, 69, 96, 0.15) !important;
  border-left-color: #e94560 !important;
  box-shadow: 0 0 12px rgba(233, 69, 96, 0.4);
}
</style>
