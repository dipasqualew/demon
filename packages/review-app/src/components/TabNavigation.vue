<script setup lang="ts">
interface Tab {
  id: string;
  label: string;
}

defineProps<{
  tabs: Tab[];
}>();

const activeTab = defineModel<string>({ required: true });
</script>

<template>
  <v-tabs
    v-model="activeTab"
    bg-color="surface"
    color="primary"
    slider-color="primary"
    data-testid="tab-navigation"
  >
    <v-tab
      v-for="tab in tabs"
      :key="tab.id"
      :value="tab.id"
      :data-tab="tab.id"
    >
      {{ tab.label }}
    </v-tab>
  </v-tabs>
  <v-divider color="primary" :thickness="2" />
</template>
