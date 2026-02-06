<script setup lang="ts">
defineProps<{
  items: string[];
}>();

const emit = defineEmits<{
  remove: [index: number];
}>();
</script>

<template>
  <div class="feedback-list-section" data-testid="feedback-list">
    <v-list density="compact" bg-color="transparent" id="feedback-list">
      <v-list-item
        v-for="(item, index) in items"
        :key="index"
        class="feedback-item pa-2 mb-1 rounded"
        data-testid="feedback-item"
      >
        <div class="d-flex align-center w-100">
          <span class="flex-grow-1">{{ item }}</span>
          <v-btn
            variant="text"
            color="error"
            size="x-small"
            class="feedback-remove"
            data-testid="feedback-remove"
            :data-index="index"
            @click="emit('remove', index)"
          >
            X
          </v-btn>
        </div>
      </v-list-item>
    </v-list>
  </div>
</template>

<style scoped>
.feedback-item {
  background: #16213e;
  border: 1px solid #0f3460;
}
</style>
