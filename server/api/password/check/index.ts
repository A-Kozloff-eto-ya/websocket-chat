export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { password } = body
  const config = useRuntimeConfig()

  return { valid: password === config.password }
})
