<!-- pages/login.vue -->
<template>
  <div class="min-h-screen w-full flex items-center justify-center bg-[#f7f7ff]">
    <form class="mt-8 space-y-6" @submit.prevent="handleSubmit">
      <h1 class="text-center text-3xl font-extrabold text-gray-900">Авторизация</h1>

      <div class="field">
        <input id="password" v-model="password" type="text" required placeholder="Секретная фраза"
          class="block w-full px-3 py-2 border rounded-md border-[#1a3678]" :disabled="loading"/>
      </div>

      <button type="submit" :disabled="loading || !password.trim()" class="w-full py-2 bg-[#1a3678] text-white rounded-md disabled:opacity-50 font-medium">
        {{ loading ? 'Проверка...' : 'Войти' }}
      </button>

      <div v-if="error" class="error">{{ error }}</div>
    </form>
  </div>
</template>

<script setup lang="ts">
const password = ref('')
const route = useRoute()
const { loading, error, isValid, checkPassword, clear } = useAuth()

const handleSubmit = async () => {
  clear()
  const success = await checkPassword(password.value)

  if (success) {
    const redirectTo = (route.query.redirect as string) || '/'
    await navigateTo(redirectTo)
  }
}
</script>
