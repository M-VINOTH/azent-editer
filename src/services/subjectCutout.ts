export async function cutOutSubject(imageUrl: string): Promise<string> {
  const source = await fetch(imageUrl)
  if (!source.ok) throw new Error("Could not read this photo.")
  const blob = await source.blob()
  const response = await fetch("/api/cutout", {
    method: "POST",
    headers: { "content-type": blob.type || "image/jpeg" },
    body: blob,
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error ?? "Could not select the subject.")
  }
  const png = await response.blob()
  return await blobToDataUrl(png)
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("Could not keep the cutout."))
    reader.readAsDataURL(blob)
  })
}
