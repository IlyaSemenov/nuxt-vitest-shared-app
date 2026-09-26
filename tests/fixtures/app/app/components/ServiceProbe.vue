<script setup lang="ts">
import { getService } from "~/services/service"

const { $service } = useNuxtApp()
const fromModule = getService()
</script>

<template>
  <p>{{ $service.id }}:{{ fromModule?.id }}</p>
</template>
