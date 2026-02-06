<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { mdiPlay, mdiPause } from "@mdi/js";
import { useVideoPlayer } from "../composables/useVideoPlayer";
import type { DemoMetadata } from "../types";

const props = defineProps<{
  src: string;
  demo: DemoMetadata;
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const demoRef = computed(() => props.demo);

const {
  isPlaying,
  progress,
  formattedCurrentTime,
  formattedDuration,
  togglePlay,
  seekToPercent,
  startSeeking,
  endSeeking,
} = useVideoPlayer(videoRef, demoRef);

const sliderValue = ref(0);

watch(progress, (val) => {
  sliderValue.value = val;
});

function handleSliderInput(val: number) {
  startSeeking();
  sliderValue.value = val;
  seekToPercent(val);
}

function handleSliderEnd() {
  endSeeking();
}

function handleVideoClick() {
  togglePlay();
}
</script>

<template>
  <div class="video-wrapper" data-testid="video-player">
    <video
      ref="videoRef"
      :src="src"
      class="video-element"
      @click="handleVideoClick"
    />
    <div class="video-controls pa-2">
      <v-btn
        :icon="isPlaying ? mdiPause : mdiPlay"
        size="small"
        variant="text"
        density="compact"
        @click="togglePlay"
        id="vc-play"
      />
      <v-slider
        :model-value="sliderValue"
        min="0"
        max="100"
        step="0.1"
        hide-details
        thumb-size="12"
        track-size="4"
        color="primary"
        class="mx-2 flex-grow-1"
        id="vc-seek"
        @update:model-value="handleSliderInput"
        @end="handleSliderEnd"
      />
      <span class="vc-time text-caption text-grey" id="vc-time">
        {{ formattedCurrentTime }} / {{ formattedDuration }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.video-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: 100%;
}

.video-element {
  width: 100%;
  max-height: calc(100% - 48px);
  border-radius: 4px 4px 0 0;
  cursor: pointer;
}

.video-controls {
  display: flex;
  align-items: center;
  background: #16213e;
  border-radius: 0 0 4px 4px;
}

.vc-time {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  min-width: 80px;
  text-align: right;
}
</style>
