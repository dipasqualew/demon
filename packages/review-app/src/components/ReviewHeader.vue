<script setup lang="ts">
defineProps<{
  title: string;
}>();
</script>

<template>
  <v-app-bar flat color="surface" density="compact" data-testid="review-header">
    <v-app-bar-title class="text-primary font-weight-bold">
      {{ title }}
    </v-app-bar-title>
  </v-app-bar>
</template>
