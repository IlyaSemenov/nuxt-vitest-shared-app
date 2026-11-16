<script setup lang="ts">
const props = defineProps<{ label: string }>()
const emit = defineEmits<{ ping: [label: string] }>()
const theme = inject("probe-root-theme", "none")
</script>

<template>
  <button type="button" @click="emit('ping', props.label)">
    {{ props.label }} / {{ theme }}
    <slot />
  </button>
</template>
