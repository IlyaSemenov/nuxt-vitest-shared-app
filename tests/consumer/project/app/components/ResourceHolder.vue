<script setup lang="ts">
const resource = { released: false }
heldResources.add(resource)
onUnmounted(() => {
  resource.released = true
  heldResources.delete(resource)
})
</script>

<template>
  <p>holding</p>
</template>
