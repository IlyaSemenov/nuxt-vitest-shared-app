<script setup lang="ts">
import { useInfiniteScroll } from "@vueuse/core"

const loads = ref(0)
useInfiniteScroll(window, () => {
  loads.value++
})
</script>

<template>
  <div>loads: {{ loads }}</div>
</template>
