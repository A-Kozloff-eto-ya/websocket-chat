// composables/useAuth.ts
import { ref } from 'vue'

const isValid = ref(false)

export const useAuth = () => {
  const loading = ref(false)
  const error = ref<string | null>(null)

  const checkPassword = async (password: string): Promise<boolean> => {
    loading.value = true
    error.value = null

    try {
      const res = await $fetch<{ valid: boolean }>('/api/password/check', {
        method: 'POST',
        body: { password }
      })

      isValid.value = !!res.valid
      if (!isValid.value) {
        error.value = 'Неверный пароль'
      }

      return isValid.value
    } catch (e) {
      error.value = 'Ошибка проверки пароля'
      isValid.value = false
      return false
    } finally {
      loading.value = false
    }
  }

  const clear = () => {
    isValid.value = false
    error.value = null
    loading.value = false
  }

  return { loading, error, isValid, checkPassword, clear }
}
