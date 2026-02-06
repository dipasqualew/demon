<script setup lang="ts">
defineProps<{
  highlights: string[];
}>();
</script>

<template>
  <div class="highlights-section" data-testid="highlights-list">
    <h2 class="text-primary text-h6 mb-2">Highlights</h2>
    <v-list density="compact" bg-color="transparent">
      <v-list-item
        v-for="(highlight, index) in highlights"
        :key="index"
        class="text-success pa-0"
      >
        <template #prepend>
          <span class="mr-2">-</span>
        </template>
        {{ highlight }}
      </v-list-item>
    </v-list>
  </div>
</template>
