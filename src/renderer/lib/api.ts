// Thin wrapper around window.api.invoke that throws on error
export async function invoke<T = any>(channel: string, ...args: any[]): Promise<T> {
  const result = await window.api.invoke(channel, ...args)
  if (!result.ok) throw new Error(result.error ?? `IPC call to ${channel} failed`)
  return result.data as T
}
