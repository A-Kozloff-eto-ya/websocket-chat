// middleware/auth.global.ts
export default defineNuxtRouteMiddleware((to) => {
  // страницу логина не трогаем
  if (to.path === '/login') return

  const { isValid } = useAuth()

  if (!isValid.value) {
    return navigateTo({
      path: '/login',
      query: { redirect: to.fullPath }
    })
  }
})
