<script setup lang="ts">
import type { DemoMetadata } from "../types";

defineProps<{
  demos: DemoMetadata[];
  activeIndex: number;
}>();

const emit = defineEmits<{
  select: [index: number];
}>();
</script>

<template>
  <div class="demo-list-section" data-testid="demo-list">
    <h2 class="text-primary text-subtitle-1 font-weight-bold mb-2">Demos</h2>
    <v-list density="compact" bg-color="transparent" nav id="demo-list">
      <v-list-item
        v-for="(demo, index) in demos"
        :key="demo.file"
        :active="index === activeIndex"
        color="primary"
        rounded
        class="mb-1"
        :data-index="index"
        @click="emit('select', index)"
      >
        {{ demo.file }}
      </v-list-item>
    </v-list>
  </div>
</template>
