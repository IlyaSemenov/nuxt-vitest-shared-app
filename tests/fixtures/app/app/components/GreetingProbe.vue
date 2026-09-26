<script setup lang="ts">
const route = useRoute()
const greeting = useGreeting(String(route.params.name ?? "nobody"))
</script>

<template>
  <p>{{ greeting }}</p>
</template>
